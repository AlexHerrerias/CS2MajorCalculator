"""Management command: bulk-update non-terminal matches from Liquipedia.

Replaces the previous `update_hltv_matches` command. Honors the
MatchUpdateSettings singleton: both is_active and use_liquipedia_api must be
True for the job to actually call the API.

Usage:
    python manage.py update_matches
"""

import logging

from django.core.management.base import BaseCommand

from tournaments.liquipedia_service import bulk_update_matches_from_liquipedia

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fetch fresh match results from Liquipedia for all non-FINISHED matches with a liquipedia_page_name set."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting Liquipedia match update..."))
        logger.info("update_matches command invoked.")
        try:
            summary = bulk_update_matches_from_liquipedia()
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Update failed: {e}"))
            logger.exception("update_matches command failed: %s", e)
            return

        if summary.get("skipped_reason") == "disabled":
            self.stdout.write(
                self.style.WARNING(
                    "Skipped: MatchUpdateSettings has is_active=False or use_liquipedia_api=False."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. processed={summary['processed']} "
                f"updated={summary['updated']} failed={summary['failed']}"
            )
        )
