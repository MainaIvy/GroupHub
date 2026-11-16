# GroupHub Deployment Guide

GroupHub deployed on the free tier:
- **Backend:** Django on Render (free web service)
- **Database:** PostgreSQL on Neon
- **Frontend:** React/Vite on Vercel

No features, UI, or business logic were changed — only configuration and deployment readiness.

## Prerequisites

- GitHub account with the GroupHub repo pushed
- [Neon](https://neon.tech) account (free tier)
- [Render](https://render.com) account (free tier)
- [Vercel](https://vercel.com) account

## Step 1: Database — Neon (PostgreSQL)

1. Sign in to Neon and create a new project.
2. Note the PostgreSQL version and database name.
3. Open the project dashboard → Connection details → copy the connection string. It looks like:

   ```
   postgres://<user>:<password>@ep-<id>.<region>.aws.neon.tech/<dbname>?sslmode=require
   ```

4. Paste this string as `DATABASE_URL` in Render (Step 2).

Django connects via `dj-database-url` with `psycopg2-binary`. Locally, if `DATABASE_URL` is unset, the app falls back to the existing local sqlite database so development keeps working.

## Step 2: Backend — Render (free web service)

1. Create a new **Web Service** on Render and connect your GitHub repo.
2. Set **Root directory** to `backend` (this is where `manage.py` and `requirements.txt` live).
3. Render picks up `backend/render.yaml`, which defines:
   - Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - Start command: `daphne -b 0.0.0.0 -p $PORT backend.asgi:application` (Daphne ASGI server, so HTTP + WebSockets work)
4. Add the following **Environment Variables** in the Render dashboard:

| Variable | Value | Notes |
|---|---|---|
| `SECRET_KEY` | Long random string | Render can generate one for you |
| `DEBUG` | `False` | Production must be `False` |
| `ALLOWED_HOSTS` | `<your-app>.onrender.com` | Your Render service hostname |
| `DATABASE_URL` | Neon connection string from Step 1 | Required |
| `CORS_ALLOWED_ORIGINS` | `https://<your-app>.vercel.app` | Your Vercel frontend URL |
| `CSRF_TRUSTED_ORIGINS` | `https://<your-app>.vercel.app,https://<your-app>.onrender.com` | Frontend + backend URLs |
| `REDIS_URL` | (optional) Redis URL | Omit to use the in-memory channel layer |

5. Deploy. Render runs `migrate` during the build, then starts Daphne.
6. Get your Render URL (e.g. `https://grouphub-backend.onrender.com`) and add it to `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` if you didn't already, then redeploy.

**Free-tier note:** Render free web services spin down after ~15 minutes of inactivity; the first request after sleep is slow. WebSockets work while the service is awake; for guaranteed WebSocket uptime use a paid Render instance (the code is already configured for it).

### Build script

`backend/build.sh` contains the same three steps as the Render build command (`pip install`, `collectstatic`, `migrate`) and can be run locally or in any CI.

## Step 3: Frontend — Vercel

1. Create a new project on Vercel and import the GroupHub repo.
2. Set **Root directory** to `frontend`.
3. Framework preset: **Vite**. Build command: `npm run build`, output directory: `dist` (Vercel detects this automatically).
4. Add the following **Environment Variable** in the Vercel project settings:

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://<your-app>.onrender.com` | Your Render backend URL |

5. Deploy.
6. `frontend/vercel.json` rewrites all non-API/non-asset routes to `/index.html`, so React Router routes such as `/student/dashboard` work on refresh.
7. Add the Vercel URL to the backend's `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` on Render and redeploy the backend.

## Environment variable summary

Backend (Render dashboard → Environment variables):

| Variable | Where to paste |
|---|---|
| `SECRET_KEY` | Render → Web Service → Environment |
| `DEBUG` | Render → Web Service → Environment |
| `ALLOWED_HOSTS` | Render → Web Service → Environment |
| `DATABASE_URL` | Render → Web Service → Environment (from Neon) |
| `CORS_ALLOWED_ORIGINS` | Render → Web Service → Environment (from Vercel) |
| `CSRF_TRUSTED_ORIGINS` | Render → Web Service → Environment (Vercel + Render URLs) |
| `REDIS_URL` | Render → Web Service → Environment (optional) |

Frontend (Vercel → Project Settings → Environment Variables):

| Variable | Where to paste |
|---|---|
| `VITE_API_URL` | Vercel → Project Settings → Environment Variables (from Render) |

## Local development

```bash
# Backend
cp backend/.env.example backend/.env
cd backend
python manage.py check
python manage.py runserver   # serves on http://127.0.0.1:8000
python manage.py seed_demo   # idempotent: safe to run more than once

# Frontend
cp frontend/.env.example frontend/.env
cd frontend
npm install
npm run dev                  # serves on http://localhost:5173, proxies /api and /ws to the backend
```

- Real `.env` files are listed in `.gitignore` (both root and frontend) and must never be committed. `.env.example` files are safe to commit.
- The seed command (`seed_demo`) uses `update_or_create` and clears/recreates demo data per run, so it can be run safely more than once.
- The app runs under any ASGI server (`daphne`, `uvicorn`, etc.) via `backend.asgi:application`; `daphne` is already in `INSTALLED_APPS` and `requirements.txt`. The channel layer uses `InMemoryChannelLayer` unless `REDIS_URL` is set.

## Verification

```bash
cd backend && python manage.py check
cd frontend && npm run build
```

## Files changed

- `backend/requirements.txt` — added gunicorn, whitenoise, dj-database-url, psycopg2-binary (daphne already present for Channels/WebSockets)
- `backend/backend/settings.py` — env-based SECRET_KEY, DEBUG, ALLOWED_HOSTS, DATABASE_URL, CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS; WhiteNoise middleware + STATIC_ROOT; Redis-aware channel layer
- `backend/build.sh` — Render-compatible build script
- `backend/render.yaml` — Render service spec (build + Daphne start command)
- `frontend/src/apiConfig.js` — new: `API_BASE` and `wsUrl()` from `VITE_API_URL`
- `frontend/src/api.js` — axios `baseURL` from `API_BASE`
- `frontend/src/components/Chat.jsx` — API root and WebSocket URL from env helpers
- `frontend/src/components/GroupChatRoom.jsx` — chat fetch and WebSocket URL from env helpers
- `frontend/vite.config.js` — proxy targets driven by `VITE_API_URL` (localhost fallback)
- `frontend/vercel.json` — SPA rewrite for React Router refreshes
- `backend/.env.example` — backend example environment file
- `frontend/.env.example` — frontend example environment file
- `DEPLOY.md` — this file
