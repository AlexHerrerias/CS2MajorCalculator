"""Production settings — Postgres via DATABASE_URL, WhiteNoise, secure headers."""

from .base import *  # noqa: F401, F403
from .base import MIDDLEWARE, env


DEBUG = False


DATABASES = {
    "default": env.db("DATABASE_URL"),
}


# Always permit Render-assigned hostnames so the first deploy passes its health
# check before the operator narrows DJANGO_ALLOWED_HOSTS to the real domain.
ALLOWED_HOSTS = list({*env("DJANGO_ALLOWED_HOSTS", default=[]), ".onrender.com"})


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    *MIDDLEWARE[1:],
]

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}


SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
