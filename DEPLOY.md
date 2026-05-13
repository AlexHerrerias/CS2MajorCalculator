# Deploying to Render

Step-by-step to get the API, the SPA and the database running on Render with
the `render.yaml` blueprint in this repo.

> **Heads-up:** Render's free tier puts web services to sleep after 15 minutes
> of inactivity (cold start ≈ 30 s) and limits Postgres to 90 days. Plenty for
> a portfolio / demo, not for production traffic.

## 1. One-time GitHub prep

1. Push `master` to `github.com/<you>/CS2MajorCalculator` (already done).
2. Make sure the repo is **public** or you grant Render access via the GitHub
   App.

## 2. Apply the Blueprint

1. Sign in at <https://dashboard.render.com>.
2. **New +** → **Blueprint**.
3. Pick the repo and the `master` branch. Render reads `render.yaml`.
4. Confirm the resources it will create:
   - `cs2-major-calculator-api` (Web Service · Python · free)
   - `cs2-major-calculator-web` (Static Site · free)
   - `cs2-major-db` (Postgres · free)
5. Click **Apply**. Render starts provisioning. The database is ready in ~1 min;
   the API service runs `pip install + collectstatic + migrate` before it goes
   live (3–5 min on cold cache).

## 3. Fill in the manual env vars

Once both services exist, copy the public URLs Render assigns (something like
`https://cs2-major-calculator-api.onrender.com` and
`https://cs2-major-calculator-web.onrender.com`) and set the values flagged
`sync: false` in the blueprint:

### API service env vars

| Key                     | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `DJANGO_ALLOWED_HOSTS`  | `cs2-major-calculator-api.onrender.com`                                        |
| `FRONTEND_URL`          | `https://cs2-major-calculator-web.onrender.com`                                |
| `CORS_ALLOWED_ORIGINS`  | `https://cs2-major-calculator-web.onrender.com`                                |
| `CSRF_TRUSTED_ORIGINS`  | `https://cs2-major-calculator-web.onrender.com`                                |
| `TWITCH_CLIENT_ID`      | from <https://dev.twitch.tv/console/apps>                                      |
| `TWITCH_CLIENT_SECRET`  | from the same Twitch app                                                       |
| `TWITCH_REDIRECT_URI`   | `https://cs2-major-calculator-api.onrender.com/api/auth/twitch/callback/`      |

In the Twitch app, register **OAuth Redirect URLs** with that exact callback
URL so the OAuth handshake succeeds.

### Frontend static site env var

| Key                  | Value                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`  | `https://cs2-major-calculator-api.onrender.com/api`                            |

Vite inlines this at build time, so after saving you have to trigger a
re-deploy (Render does it automatically when env vars change, but be patient
on the free tier).

## 4. Seed the production database (optional)

Render shells aren't available on free tier, so:

1. Locally, set `DATABASE_URL` to the **external** connection string Render shows
   in the database page (`postgresql://...`).
2. Run:
   ```bash
   DJANGO_SETTINGS_MODULE=backend.settings.prod \
   DJANGO_SECRET_KEY=ignored \
   DJANGO_ALLOWED_HOSTS=localhost \
   FRONTEND_URL=http://localhost:3000 \
   CORS_ALLOWED_ORIGINS=http://localhost:3000 \
   CSRF_TRUSTED_ORIGINS=http://localhost:3000 \
   python manage.py createsuperuser
   ```
3. Use Django admin (`https://…onrender.com/admin/`) to create the Tournament,
   Stages, Teams and the few real matches you want to seed. Everything else
   the frontend simulates client-side.

## 5. Smoke check

- `https://cs2-major-calculator-web.onrender.com/` loads, dark theme, no
  `Cargando torneo…` stuck forever.
- `https://cs2-major-calculator-api.onrender.com/api/tournaments/` returns
  the live tournament JSON.
- `https://cs2-major-calculator-api.onrender.com/admin/` shows the Django
  admin login.
- Picking winners in the bracket propagates to playoffs in the browser
  console (no `localhost:8000` 404 errors).

## 6. Rotating the leaked Postgres password

Before the blueprint deploy is live, **rotate** the `dxzp1944` password that
leaked in commit `eb41add`. Render's managed Postgres generates a fresh
password on creation, so the new instance is unrelated, but if you still
have that database alive anywhere else (Heroku, Railway, a VPS), change it
now. Force-rotating Render's password later is one click in the dashboard.

---

When all of the above is green, the project is officially production-ready.
