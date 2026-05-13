"""Idempotent recompute of Swiss-stage state.

Single source of truth for both `views.update_match_result` and
`liquipedia_service.update_single_match_from_liquipedia` (and any future caller
that mutates a Match). Given a `Stage`, derives:

- `StageTeam.wins`, `StageTeam.losses` from the set of FINISHED matches.
- `StageTeam.buchholz_score`: standard CS Swiss Buchholz, i.e. the sum of the
  final win counts of each opponent the team has played in this stage. Self
  is excluded; opponents outside this stage are ignored.

The function is intentionally derived from match state, not incremental — so
callers can flip a previous result or delete a match and the standings stay
consistent without any "reverse the previous change" bookkeeping.
"""

from .models import Match, Stage, StageTeam


def recalculate_swiss_stage_state(stage: Stage) -> None:
    stage_teams_map: dict[int, StageTeam] = {
        st.team_id: st for st in StageTeam.objects.filter(stage=stage)
    }
    if not stage_teams_map:
        return

    # Reset before recomputing.
    for st in stage_teams_map.values():
        st.wins = 0
        st.losses = 0
        st.buchholz_score = 0.0

    # opponents[team_id] is the set of team_ids that team has FINISHED a match
    # against in this stage. Sets so a (theoretical) rematch doesn't double count
    # for Buchholz — even though Swiss should never produce one.
    opponents: dict[int, set[int]] = {tid: set() for tid in stage_teams_map}

    for m in Match.objects.filter(stage=stage, status="FINISHED").only(
        "team1_id", "team2_id", "winner_id"
    ):
        winner_id = m.winner_id
        if not winner_id:
            continue
        if winner_id == m.team1_id:
            loser_id = m.team2_id
        elif winner_id == m.team2_id:
            loser_id = m.team1_id
        else:
            # winner doesn't belong to this match; ignore the row.
            continue

        if winner_id in stage_teams_map:
            stage_teams_map[winner_id].wins += 1
        if loser_id in stage_teams_map:
            stage_teams_map[loser_id].losses += 1

        if m.team1_id in opponents:
            opponents[m.team1_id].add(m.team2_id)
        if m.team2_id in opponents:
            opponents[m.team2_id].add(m.team1_id)

    # Buchholz = sum of opponent wins (computed AFTER all wins are settled).
    for team_id, st in stage_teams_map.items():
        st.buchholz_score = float(
            sum(
                stage_teams_map[opp_id].wins
                for opp_id in opponents[team_id]
                if opp_id in stage_teams_map
            )
        )

    for st in stage_teams_map.values():
        st.save(update_fields=["wins", "losses", "buchholz_score", "updated_at"])
