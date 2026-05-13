"""Liquipedia Cargo API integration for match results.

Replaces the previous mock-only `hltv_service.py`. Public entry points:

- `fetch_match_from_liquipedia(page_name)` — low-level: one Cargo query, parsed.
- `update_single_match_from_liquipedia(match_id)` — apply Liquipedia data to a
  Match row. Idempotent: returns False (no changes) on second call with same
  upstream data.
- `bulk_update_matches_from_liquipedia()` — iterate non-FINISHED matches with a
  liquipedia_page_name set. Gated by the MatchUpdateSettings singleton.

Rate limit: Liquipedia Cargo allows ~30 req/min. We enforce a 2.1s minimum
between calls process-wide. Cache hits skip the wait.

User-Agent: settings.LIQUIPEDIA_USER_AGENT (required by Liquipedia ToS).
"""

import logging
import threading
import time

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import Match, MatchUpdateSettings, Team
from .stage_recalc import recalculate_swiss_stage_state

logger = logging.getLogger(__name__)

LIQUIPEDIA_API_URL = "https://liquipedia.net/counterstrike/api.php"
CACHE_TTL_SECONDS = 300
MIN_REQUEST_INTERVAL_SECONDS = 2.1
REQUEST_TIMEOUT_SECONDS = 10

_rate_limit_lock = threading.Lock()
_last_request_at: float = 0.0

_ACTIVE_STATUSES = ("PENDING", "LIVE")
_TERMINAL_STATUSES = ("FINISHED", "CANCELED")


def _wait_for_rate_limit() -> None:
    global _last_request_at
    with _rate_limit_lock:
        elapsed = time.monotonic() - _last_request_at
        if elapsed < MIN_REQUEST_INTERVAL_SECONDS:
            time.sleep(MIN_REQUEST_INTERVAL_SECONDS - elapsed)
        _last_request_at = time.monotonic()


def _query_cargo(tables: str, fields: str, where: str, limit: int = 1) -> dict | None:
    cache_key = f"liquipedia:cargo:{tables}:{fields}:{where}:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    params = {
        "action": "cargoquery",
        "tables": tables,
        "fields": fields,
        "where": where,
        "limit": str(limit),
        "format": "json",
    }
    headers = {
        "User-Agent": settings.LIQUIPEDIA_USER_AGENT,
        "Accept": "application/json",
    }

    _wait_for_rate_limit()
    try:
        response = requests.get(
            LIQUIPEDIA_API_URL,
            params=params,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        logger.error("Liquipedia request failed for where=%r: %s", where, e)
        return None
    except ValueError as e:
        logger.error("Liquipedia response not JSON for where=%r: %s", where, e)
        return None

    cache.set(cache_key, data, CACHE_TTL_SECONDS)
    return data


def _parse_score_pair(score_str: str | None) -> tuple[int, int] | None:
    if not score_str:
        return None
    try:
        normalized = score_str.replace("-", ":")
        parts = normalized.split(":")
        if len(parts) != 2:
            return None
        return int(parts[0].strip()), int(parts[1].strip())
    except (ValueError, AttributeError):
        return None


def parse_match_response(raw: dict | None) -> dict | None:
    """Map a Cargo response payload to the shape consumers expect.

    Returns a dict with these keys, or None if the payload is empty/malformed:
        page_name, status, team1_name, team2_name,
        team1_score, team2_score, winner_name, map_scores
    """
    if not raw or "cargoquery" not in raw or not raw["cargoquery"]:
        return None
    row = raw["cargoquery"][0].get("title")
    if not row:
        return None

    overall = _parse_score_pair(row.get("Score"))
    if overall is None:
        team1_score = team2_score = 0
    else:
        team1_score, team2_score = overall

    winner_name = (row.get("Winner") or "").strip() or None

    map_scores: list[tuple[int, int] | None] = []
    for i in (1, 2, 3):
        map_scores.append(_parse_score_pair(row.get(f"Map{i}Score")))

    if winner_name and overall is not None:
        status = "FINISHED"
    elif overall is not None and (team1_score > 0 or team2_score > 0):
        status = "LIVE"
    else:
        status = "PENDING"

    return {
        "page_name": row.get("PageName"),
        "status": status,
        "team1_name": (row.get("Opponent1") or "").strip(),
        "team2_name": (row.get("Opponent2") or "").strip(),
        "team1_score": team1_score,
        "team2_score": team2_score,
        "winner_name": winner_name,
        "map_scores": map_scores,
    }


def fetch_match_from_liquipedia(page_name: str) -> dict | None:
    if not page_name:
        return None

    escaped = page_name.replace('"', '\\"')
    where = f'PageName = "{escaped}"'
    fields = (
        "MatchId, PageName, Tournament, Date, Opponent1, Opponent2, "
        "Opponent1Score, Opponent2Score, Score, Winner, Bestof, "
        "Map1Score, Map2Score, Map3Score"
    )
    raw = _query_cargo("MatchSchedule", fields, where, limit=1)
    if raw is None:
        return None
    return parse_match_response(raw)


def update_single_match_from_liquipedia(match_id: int) -> bool:
    """Apply Liquipedia data to a Match row.

    Returns True when at least one field changed and was saved, False otherwise
    (including: match not found, no page name configured, fetch error, or
    upstream data already matches local state). Idempotent.
    """
    try:
        match = Match.objects.get(pk=match_id)
    except Match.DoesNotExist:
        logger.error("Match id %s not found.", match_id)
        return False

    if not match.liquipedia_page_name:
        logger.info("Match %s has no liquipedia_page_name; skip.", match_id)
        return False

    data = fetch_match_from_liquipedia(match.liquipedia_page_name)
    if data is None:
        logger.warning("No data fetched for match %s.", match_id)
        return False

    changed = False

    new_status = data.get("status")
    if new_status and new_status != match.status:
        match.status = new_status
        changed = True

    team1_score = data.get("team1_score")
    if team1_score is not None and team1_score != match.team1_score:
        match.team1_score = team1_score
        changed = True

    team2_score = data.get("team2_score")
    if team2_score is not None and team2_score != match.team2_score:
        match.team2_score = team2_score
        changed = True

    for idx, pair in enumerate(data.get("map_scores") or [], start=1):
        if pair is None:
            continue
        t1_field = f"map{idx}_team1_score"
        t2_field = f"map{idx}_team2_score"
        if hasattr(match, t1_field) and getattr(match, t1_field) != pair[0]:
            setattr(match, t1_field, pair[0])
            changed = True
        if hasattr(match, t2_field) and getattr(match, t2_field) != pair[1]:
            setattr(match, t2_field, pair[1])
            changed = True

    winner_name = data.get("winner_name")
    if new_status == "FINISHED" and winner_name:
        winner_team = Team.objects.filter(name=winner_name).first()
        if winner_team and match.winner_id != winner_team.id:
            match.winner = winner_team
            changed = True
        elif not winner_team:
            logger.warning(
                "Winner %r not found in Team table for match %s.",
                winner_name, match_id,
            )

    if changed:
        match.last_external_update = timezone.now()
        match.save()
        if match.stage_id and match.stage.type == "SWISS":
            recalculate_swiss_stage_state(match.stage)
        logger.info("Match %s updated from Liquipedia.", match_id)
    else:
        logger.info("Match %s: no changes from Liquipedia.", match_id)
    return changed


def bulk_update_matches_from_liquipedia() -> dict:
    """Iterate non-terminal matches with a liquipedia_page_name. Gated by settings.

    Returns {'processed': N, 'updated': X, 'failed': Y[, 'skipped_reason']}.
    """
    settings_obj = MatchUpdateSettings.load()
    if not settings_obj.is_active or not settings_obj.use_liquipedia_api:
        logger.info("Match update from Liquipedia disabled; nothing to do.")
        return {
            "processed": 0,
            "updated": 0,
            "failed": 0,
            "skipped_reason": "disabled",
        }

    qs = (
        Match.objects.filter(status__in=_ACTIVE_STATUSES)
        .filter(liquipedia_page_name__isnull=False)
        .exclude(liquipedia_page_name="")
    )

    processed = updated = failed = 0
    for m in qs:
        processed += 1
        try:
            if update_single_match_from_liquipedia(m.id):
                updated += 1
        except Exception as e:
            failed += 1
            logger.exception("Update failed for match %s: %s", m.id, e)

    logger.info(
        "Liquipedia bulk update done. processed=%s updated=%s failed=%s",
        processed, updated, failed,
    )
    return {"processed": processed, "updated": updated, "failed": failed}
