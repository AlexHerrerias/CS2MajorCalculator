import json
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse

from .fantasy_logic import calculate_phase_pick_points, calculate_playoff_pick_points
from .liquipedia_service import (
    parse_match_response,
    update_single_match_from_liquipedia,
)
from .models import (
    FantasyPhasePick,
    FantasyPlayoffPick,
    Match,
    Stage,
    StageTeam,
    Team,
    Tournament,
    UserProfile,
)


# ---------------------------------------------------------------------------
# Twitch OAuth (PR #1)
# ---------------------------------------------------------------------------

@override_settings(
    TWITCH_CLIENT_ID="test-client-id",
    TWITCH_CLIENT_SECRET="test-client-secret",
    TWITCH_REDIRECT_URI="http://testserver/api/auth/twitch/callback/",
    FRONTEND_URL="http://frontend.test",
)
class TwitchOAuthCallbackTest(TestCase):
    """Cover the Twitch OAuth callback: missing code, new user, returning user."""

    def setUp(self):
        self.url = reverse("twitch-callback")

    def _mock_twitch_success(self, mock_requests, twitch_id, login, email):
        token_response = MagicMock()
        token_response.json.return_value = {"access_token": "token-xyz"}
        token_response.raise_for_status.return_value = None
        mock_requests.post.return_value = token_response

        user_response = MagicMock()
        user_response.json.return_value = {
            "data": [
                {
                    "id": twitch_id,
                    "login": login,
                    "display_name": login.capitalize(),
                    "profile_image_url": f"https://twitch.tv/{login}.png",
                    "email": email,
                }
            ]
        }
        user_response.raise_for_status.return_value = None
        mock_requests.get.return_value = user_response

    def test_callback_without_code_returns_400(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 400)
        self.assertIn("No authorization code", response.json()["error"])

    @patch("tournaments.auth_views.requests")
    def test_callback_creates_new_user_and_redirects_to_frontend(self, mock_requests):
        self._mock_twitch_success(
            mock_requests,
            twitch_id="123456",
            login="newviewer",
            email="newviewer@example.test",
        )

        response = self.client.get(self.url, {"code": "auth-code"})

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "http://frontend.test")
        self.assertTrue(UserProfile.objects.filter(twitch_id="123456").exists())
        profile = UserProfile.objects.get(twitch_id="123456")
        self.assertEqual(profile.twitch_username, "newviewer")
        self.assertEqual(profile.user.email, "newviewer@example.test")

    @patch("tournaments.auth_views.requests")
    def test_callback_reuses_existing_profile(self, mock_requests):
        existing_user = User.objects.create_user(username="oldviewer")
        UserProfile.objects.create(
            user=existing_user,
            twitch_id="999",
            twitch_username="oldviewer",
        )

        self._mock_twitch_success(
            mock_requests,
            twitch_id="999",
            login="oldviewer",
            email="oldviewer@example.test",
        )

        response = self.client.get(self.url, {"code": "auth-code"})

        self.assertEqual(response.status_code, 302)
        self.assertEqual(User.objects.filter(username="oldviewer").count(), 1)
        self.assertEqual(UserProfile.objects.filter(twitch_id="999").count(), 1)


# ---------------------------------------------------------------------------
# Liquipedia service (PR #2)
# ---------------------------------------------------------------------------

class LiquipediaParserTest(TestCase):
    """parse_match_response must handle FINISHED/LIVE/PENDING and empty payloads."""

    def test_finished_match_with_winner_and_maps(self):
        raw = {
            "cargoquery": [{
                "title": {
                    "PageName": "PGL/2024/StageA/Round1_Match1",
                    "Opponent1": "Team Spirit",
                    "Opponent2": "FaZe",
                    "Score": "2:0",
                    "Winner": "Team Spirit",
                    "Map1Score": "13:9",
                    "Map2Score": "13:7",
                }
            }]
        }
        result = parse_match_response(raw)
        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "FINISHED")
        self.assertEqual(result["team1_name"], "Team Spirit")
        self.assertEqual(result["team2_name"], "FaZe")
        self.assertEqual(result["team1_score"], 2)
        self.assertEqual(result["team2_score"], 0)
        self.assertEqual(result["winner_name"], "Team Spirit")
        self.assertEqual(result["map_scores"][0], (13, 9))
        self.assertEqual(result["map_scores"][1], (13, 7))
        self.assertIsNone(result["map_scores"][2])

    def test_pending_match_without_scores(self):
        raw = {
            "cargoquery": [{
                "title": {
                    "Opponent1": "G2",
                    "Opponent2": "NAVI",
                    "Score": "",
                    "Winner": "",
                }
            }]
        }
        result = parse_match_response(raw)
        self.assertEqual(result["status"], "PENDING")
        self.assertEqual(result["team1_score"], 0)
        self.assertEqual(result["team2_score"], 0)
        self.assertIsNone(result["winner_name"])

    def test_live_match_with_partial_score(self):
        raw = {
            "cargoquery": [{
                "title": {
                    "Opponent1": "Vitality",
                    "Opponent2": "MOUZ",
                    "Score": "1:1",
                    "Winner": "",
                    "Map1Score": "13:10",
                    "Map2Score": "8:13",
                }
            }]
        }
        result = parse_match_response(raw)
        self.assertEqual(result["status"], "LIVE")
        self.assertEqual(result["team1_score"], 1)
        self.assertEqual(result["team2_score"], 1)
        self.assertIsNone(result["winner_name"])

    def test_empty_or_malformed_payload_returns_none(self):
        self.assertIsNone(parse_match_response(None))
        self.assertIsNone(parse_match_response({}))
        self.assertIsNone(parse_match_response({"cargoquery": []}))
        self.assertIsNone(parse_match_response({"cargoquery": [{}]}))


class MatchUpdateIdempotencyTest(TestCase):
    """A second call with the same upstream data must be a no-op (returns False)."""

    def setUp(self):
        self.tournament = Tournament.objects.create(
            name="Idempotency Major",
            slug="idempotency-major",
            start_date="2024-01-01",
            end_date="2024-01-10",
            location="Online",
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Swiss A",
            type="SWISS",
            order=1,
        )
        self.team1 = Team.objects.create(name="Team Spirit", region="EU")
        self.team2 = Team.objects.create(name="FaZe", region="EU")
        self.match = Match.objects.create(
            stage=self.stage,
            round_number=1,
            team1=self.team1,
            team2=self.team2,
            format="BO3",
            status="PENDING",
            liquipedia_page_name="PGL/2024/Round1_Match1",
        )

    @patch("tournaments.liquipedia_service.fetch_match_from_liquipedia")
    def test_idempotent_second_call_returns_false(self, mock_fetch):
        payload = {
            "page_name": "PGL/2024/Round1_Match1",
            "status": "FINISHED",
            "team1_name": "Team Spirit",
            "team2_name": "FaZe",
            "team1_score": 2,
            "team2_score": 0,
            "winner_name": "Team Spirit",
            "map_scores": [(13, 9), (13, 7), None],
        }
        mock_fetch.return_value = payload

        first = update_single_match_from_liquipedia(self.match.id)
        self.assertTrue(first)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, "FINISHED")
        self.assertEqual(self.match.team1_score, 2)
        self.assertEqual(self.match.team2_score, 0)
        self.assertEqual(self.match.winner_id, self.team1.id)
        self.assertEqual(self.match.map1_team1_score, 13)
        self.assertEqual(self.match.map2_team1_score, 13)

        second = update_single_match_from_liquipedia(self.match.id)
        self.assertFalse(second)

    @patch("tournaments.liquipedia_service.fetch_match_from_liquipedia")
    def test_no_page_name_skips_fetch(self, mock_fetch):
        self.match.liquipedia_page_name = ""
        self.match.save()
        result = update_single_match_from_liquipedia(self.match.id)
        self.assertFalse(result)
        mock_fetch.assert_not_called()


# ---------------------------------------------------------------------------
# Fantasy points calculation (PR #2)
# ---------------------------------------------------------------------------

class FantasyPointsStageTest(TestCase):
    """One realistic Swiss scenario for calculate_phase_pick_points."""

    def setUp(self):
        self.tournament = Tournament.objects.create(
            name="Stage Points Major",
            slug="stage-points-major",
            start_date="2024-01-01",
            end_date="2024-01-10",
            location="Online",
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Stage A",
            type="SWISS",
            order=1,
        )
        self.teams = []
        for seed in range(1, 17):
            team = Team.objects.create(name=f"Team {seed}", region="EU")
            self.teams.append(team)
            if seed in (1, 2):
                wins, losses = 3, 0
            elif seed in (11, 12):
                wins, losses = 3, 1
            elif seed in (13, 14):
                wins, losses = 0, 3
            else:
                wins, losses = 1, 1
            StageTeam.objects.create(
                stage=self.stage,
                team=team,
                initial_seed=seed,
                wins=wins,
                losses=losses,
            )

        self.user = User.objects.create_user(username="alice")
        self.profile = UserProfile.objects.create(user=self.user)
        self.pick = FantasyPhasePick.objects.create(
            user_profile=self.profile, stage=self.stage
        )
        self.pick.teams_3_0.set([self.teams[0], self.teams[1]])
        self.pick.teams_advance.set([self.teams[10], self.teams[11]])
        self.pick.teams_0_3.set([self.teams[12], self.teams[13]])

    def test_phase_points_breakdown(self):
        ok = calculate_phase_pick_points(self.pick.id)
        self.assertTrue(ok)

        self.pick.refresh_from_db()
        # 2 correct 3-0 picks (seeds 1,2 — no bonus): 2 * 15 = 30
        # 2 correct advance picks (seeds 11,12 — in worst-8 underdog bonus): 2 * 5 * 1.5 = 15
        # 2 correct 0-3 picks (seeds 13,14 — no bonus): 2 * 10 = 20
        # Total: 65
        self.assertEqual(self.pick.points_earned, 65)
        self.assertTrue(self.pick.is_finalized)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.total_fantasy_points, 65)

        self.assertIn(str(self.teams[0].id), self.pick.team_points_breakdown)
        self.assertIn(str(self.teams[10].id), self.pick.team_points_breakdown)
        self.assertIn(str(self.teams[12].id), self.pick.team_points_breakdown)


class FantasyPointsPlayoffTest(TestCase):
    """Partial-correct playoff scenario for calculate_playoff_pick_points."""

    def setUp(self):
        self.tournament = Tournament.objects.create(
            name="Playoff Points Major",
            slug="playoff-points-major",
            start_date="2024-01-01",
            end_date="2024-01-10",
            location="Online",
        )
        self.playoff_stage = Stage.objects.create(
            tournament=self.tournament,
            name="Playoffs",
            type="PLAYOFF",
            order=99,
            fantasy_status="FINALIZED",
        )
        self.teams = [Team.objects.create(name=f"T{i}", region="EU") for i in range(8)]

        for a, b in [(0, 1), (2, 3), (4, 5), (6, 7)]:
            Match.objects.create(
                stage=self.playoff_stage,
                round_number=1,
                team1=self.teams[a],
                team2=self.teams[b],
                winner=self.teams[a],
                format="BO3",
                status="FINISHED",
            )
        Match.objects.create(
            stage=self.playoff_stage,
            round_number=2,
            team1=self.teams[0],
            team2=self.teams[2],
            winner=self.teams[0],
            format="BO3",
            status="FINISHED",
        )
        Match.objects.create(
            stage=self.playoff_stage,
            round_number=2,
            team1=self.teams[4],
            team2=self.teams[6],
            winner=self.teams[4],
            format="BO3",
            status="FINISHED",
        )
        Match.objects.create(
            stage=self.playoff_stage,
            round_number=3,
            team1=self.teams[0],
            team2=self.teams[4],
            winner=self.teams[0],
            format="BO5",
            status="FINISHED",
        )

        self.user = User.objects.create_user(username="bob")
        self.profile = UserProfile.objects.create(user=self.user)
        self.pick = FantasyPlayoffPick.objects.create(
            user_profile=self.profile,
            tournament=self.tournament,
            final_winner=self.teams[0],
        )
        # QF picks: 2 correct (T0, T2), 2 wrong (T1, T3). SF picks: 1 correct (T0), 1 wrong (T6).
        self.pick.quarter_final_winners.set(
            [self.teams[0], self.teams[2], self.teams[1], self.teams[3]]
        )
        self.pick.semi_final_winners.set([self.teams[0], self.teams[6]])

    def test_playoff_points_breakdown(self):
        ok = calculate_playoff_pick_points(self.pick.id)
        self.assertTrue(ok)

        self.pick.refresh_from_db()
        # 2 correct QF * 20 = 40
        # 1 correct SF * 35 = 35
        # 1 correct Final * 50 = 50
        # Total: 125
        self.assertEqual(self.pick.points_earned, 125)
        self.assertTrue(self.pick.is_finalized)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.total_fantasy_points, 125)


# ---------------------------------------------------------------------------
# Match result recalculation (PR #2)
# ---------------------------------------------------------------------------

class MatchResultRecalcTest(TestCase):
    """Posting a match result must recompute wins/losses for affected StageTeams."""

    def setUp(self):
        self.tournament = Tournament.objects.create(
            name="Recalc Test",
            slug="recalc-test",
            start_date="2024-01-01",
            end_date="2024-01-10",
            location="Online",
            is_live=True,
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Stage",
            type="SWISS",
            order=1,
        )
        self.team_a = Team.objects.create(name="Alpha", region="EU")
        self.team_b = Team.objects.create(name="Bravo", region="EU")
        StageTeam.objects.create(stage=self.stage, team=self.team_a, initial_seed=1)
        StageTeam.objects.create(stage=self.stage, team=self.team_b, initial_seed=2)
        self.match = Match.objects.create(
            stage=self.stage,
            round_number=1,
            team1=self.team_a,
            team2=self.team_b,
            format="BO3",
            status="PENDING",
        )

    def test_post_winner_recalculates_wins_and_losses(self):
        url = reverse("update-match")
        payload = {
            "tournamentSlug": "recalc-test",
            "currentStageIdFromPage": "phase1",
            "roundIndex": 0,
            "matchIndex": 0,
            "winnerId": self.team_a.id,
        }
        response = self.client.post(
            url, data=json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

        self.match.refresh_from_db()
        self.assertEqual(self.match.status, "FINISHED")
        self.assertEqual(self.match.winner_id, self.team_a.id)

        st_a = StageTeam.objects.get(stage=self.stage, team=self.team_a)
        st_b = StageTeam.objects.get(stage=self.stage, team=self.team_b)
        self.assertEqual(st_a.wins, 1)
        self.assertEqual(st_a.losses, 0)
        self.assertEqual(st_b.wins, 0)
        self.assertEqual(st_b.losses, 1)


# ---------------------------------------------------------------------------
# Swiss Buchholz simulation (audit)
# ---------------------------------------------------------------------------

class SwissBuchholzSimulationTest(TestCase):
    """End-to-end simulation of a small Swiss stage.

    4 teams, 3 rounds, every team plays every other exactly once (a closed
    schedule that doubles as a check that no team is paired twice).

    R1: T1 > T2 ; T3 > T4
        Standings after R1: T1 1-0, T2 0-1, T3 1-0, T4 0-1
    R2: T1 > T3 ; T2 > T4
        Standings after R2: T1 2-0, T2 1-1, T3 1-1, T4 0-2
    R3: T2 > T3 ; T1 > T4
        Standings after R3: T1 3-0, T2 2-1, T3 1-2, T4 0-3

    The simulation drives the public `/api/tournament/update-match/` endpoint
    (the same the frontend uses) so the recompute path in views.py is exercised
    end-to-end, not just the model.
    """

    def setUp(self):
        self.tournament = Tournament.objects.create(
            name="Swiss Sim",
            slug="swiss-sim",
            start_date="2024-01-01",
            end_date="2024-01-10",
            location="Online",
            is_live=True,
        )
        self.stage = Stage.objects.create(
            tournament=self.tournament,
            name="Swiss A",
            type="SWISS",
            order=1,
        )
        self.teams = []
        for i in range(1, 5):
            team = Team.objects.create(name=f"T{i}", region="EU")
            self.teams.append(team)
            StageTeam.objects.create(stage=self.stage, team=team, initial_seed=i)

        # Three rounds with two matches each, pairings chosen so no team plays
        # the same opponent twice.
        pairings_by_round = {
            1: [(0, 1), (2, 3)],  # T1 vs T2, T3 vs T4
            2: [(0, 2), (1, 3)],  # T1 vs T3, T2 vs T4
            3: [(1, 2), (0, 3)],  # T2 vs T3, T1 vs T4
        }
        self.matches_by_round = {}
        for round_number, pairings in pairings_by_round.items():
            self.matches_by_round[round_number] = []
            for a, b in pairings:
                match = Match.objects.create(
                    stage=self.stage,
                    round_number=round_number,
                    team1=self.teams[a],
                    team2=self.teams[b],
                    format="BO3",
                    status="PENDING",
                )
                self.matches_by_round[round_number].append(match)

        self.url = reverse("update-match")

    # -- helpers -----------------------------------------------------------

    def _post_winner(self, round_number: int, match_index_in_round: int, winner: Team):
        payload = {
            "tournamentSlug": self.tournament.slug,
            "currentStageIdFromPage": f"phase{self.stage.order}",
            "roundIndex": round_number - 1,
            "matchIndex": match_index_in_round,
            "winnerId": winner.id,
        }
        response = self.client.post(
            self.url, data=json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200, response.content)

    def _record_for(self, team: Team) -> tuple[int, int]:
        st = StageTeam.objects.get(stage=self.stage, team=team)
        return (st.wins, st.losses)

    # -- the simulation ----------------------------------------------------

    def test_three_round_swiss_recalculates_wins_losses(self):
        t1, t2, t3, t4 = self.teams

        # --- Round 1 ---
        self._post_winner(round_number=1, match_index_in_round=0, winner=t1)
        self._post_winner(round_number=1, match_index_in_round=1, winner=t3)
        self.assertEqual(self._record_for(t1), (1, 0))
        self.assertEqual(self._record_for(t2), (0, 1))
        self.assertEqual(self._record_for(t3), (1, 0))
        self.assertEqual(self._record_for(t4), (0, 1))

        # --- Round 2 ---
        self._post_winner(round_number=2, match_index_in_round=0, winner=t1)
        self._post_winner(round_number=2, match_index_in_round=1, winner=t2)
        self.assertEqual(self._record_for(t1), (2, 0))
        self.assertEqual(self._record_for(t2), (1, 1))
        self.assertEqual(self._record_for(t3), (1, 1))
        self.assertEqual(self._record_for(t4), (0, 2))

        # --- Round 3 ---
        self._post_winner(round_number=3, match_index_in_round=0, winner=t2)
        self._post_winner(round_number=3, match_index_in_round=1, winner=t1)
        self.assertEqual(self._record_for(t1), (3, 0))
        self.assertEqual(self._record_for(t2), (2, 1))
        self.assertEqual(self._record_for(t3), (1, 2))
        self.assertEqual(self._record_for(t4), (0, 3))

    def test_changing_a_winner_reverts_then_reapplies(self):
        """The endpoint resets W/L for the whole stage on every call, so flipping
        a result in a previous round must leave every team's record consistent."""
        t1, t2, t3, t4 = self.teams

        self._post_winner(round_number=1, match_index_in_round=0, winner=t1)
        self._post_winner(round_number=1, match_index_in_round=1, winner=t3)
        self._post_winner(round_number=2, match_index_in_round=0, winner=t1)
        self.assertEqual(self._record_for(t1), (2, 0))
        self.assertEqual(self._record_for(t3), (1, 1))

        # Operator realises they entered the wrong winner in R1 match 0 and flips
        # it: T2 should now have one win instead of T1.
        self._post_winner(round_number=1, match_index_in_round=0, winner=t2)

        # T1 only has its R2 victory now; T2 has its newly attributed R1 win.
        self.assertEqual(self._record_for(t1), (1, 1))
        self.assertEqual(self._record_for(t2), (1, 0))
        self.assertEqual(self._record_for(t3), (1, 1))
        self.assertEqual(self._record_for(t4), (0, 1))

    def test_match_without_winner_is_not_counted(self):
        """PENDING matches must not contribute to W/L; only FINISHED ones do."""
        t1, _t2, t3, _t4 = self.teams

        # Only one of the two R1 matches has a result.
        self._post_winner(round_number=1, match_index_in_round=0, winner=t1)

        # The unsubmitted match is still PENDING.
        pending = self.matches_by_round[1][1]
        pending.refresh_from_db()
        self.assertEqual(pending.status, "PENDING")
        self.assertIsNone(pending.winner_id)

        self.assertEqual(self._record_for(t1), (1, 0))
        # T3 and T4 haven't been involved in any FINISHED match yet.
        self.assertEqual(self._record_for(t3), (0, 0))
        self.assertEqual(self._record_for(_t4), (0, 0))

    def test_buchholz_scores_match_sum_of_opponent_wins(self):
        """After a full Swiss simulation, every StageTeam's buchholz_score should
        equal the sum of the FINAL win counts of each opponent it played.

        With this schedule (T1>T2, T3>T4 / T1>T3, T2>T4 / T2>T3, T1>T4):
            final wins: T1=3, T2=2, T3=1, T4=0
            opponents:  T1=[T2,T3,T4], T2=[T1,T4,T3], T3=[T4,T1,T2], T4=[T3,T2,T1]
            buchholz:   T1=2+1+0=3, T2=3+0+1=4, T3=0+3+2=5, T4=1+2+3=6
        """
        t1, t2, t3, t4 = self.teams
        self._post_winner(round_number=1, match_index_in_round=0, winner=t1)
        self._post_winner(round_number=1, match_index_in_round=1, winner=t3)
        self._post_winner(round_number=2, match_index_in_round=0, winner=t1)
        self._post_winner(round_number=2, match_index_in_round=1, winner=t2)
        self._post_winner(round_number=3, match_index_in_round=0, winner=t2)
        self._post_winner(round_number=3, match_index_in_round=1, winner=t1)

        expected = {t1.id: 3.0, t2.id: 4.0, t3.id: 5.0, t4.id: 6.0}
        for team in (t1, t2, t3, t4):
            st = StageTeam.objects.get(stage=self.stage, team=team)
            self.assertEqual(
                st.buchholz_score,
                expected[team.id],
                msg=f"{team.name}: expected Buchholz {expected[team.id]}, got {st.buchholz_score}",
            )


# ---------------------------------------------------------------------------
# Team world ranking (PR #3)
# ---------------------------------------------------------------------------

class TeamWorldRankingAdminTest(TestCase):
    """world_ranking is operator-managed; TeamAdmin.save_model must stamp the timestamp."""

    def setUp(self):
        from django.contrib.admin.sites import AdminSite
        from .admin import TeamAdmin

        self.admin = TeamAdmin(Team, AdminSite())
        self.team = Team.objects.create(name="Spirit", region="EU")

    def test_save_model_sets_timestamp_when_ranking_changes(self):
        class FakeForm:
            changed_data = ["world_ranking"]

        self.assertIsNone(self.team.world_ranking_updated_at)
        self.team.world_ranking = 5
        self.admin.save_model(request=None, obj=self.team, form=FakeForm(), change=True)

        self.team.refresh_from_db()
        self.assertEqual(self.team.world_ranking, 5)
        self.assertIsNotNone(self.team.world_ranking_updated_at)

    def test_save_model_preserves_timestamp_when_ranking_unchanged(self):
        from datetime import timedelta
        from django.utils import timezone

        original = timezone.now() - timedelta(days=1)
        self.team.world_ranking = 10
        self.team.world_ranking_updated_at = original
        self.team.save()

        class FakeForm:
            changed_data = ["name"]

        self.team.name = "Spirit Renamed"
        self.admin.save_model(request=None, obj=self.team, form=FakeForm(), change=True)

        self.team.refresh_from_db()
        # auto_now=False on this field, so a save with the same value should not bump it.
        self.assertEqual(self.team.world_ranking_updated_at, original)
        self.assertEqual(self.team.name, "Spirit Renamed")
