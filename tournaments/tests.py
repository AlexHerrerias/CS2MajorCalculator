from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import UserProfile


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
