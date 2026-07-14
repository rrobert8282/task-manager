# Task Manager — Gamified Productivity App

**Live demo:** https://task-manager-ten-umber.vercel.app
**API:** https://task-manager-ey7c.onrender.com

> ⚠️ The backend runs on Render's free tier, which spins down after 15 minutes of inactivity. If the app has been idle, the **first** request can take up to a minute while it wakes back up — this is expected, not a bug. Subsequent requests are fast.

A full-stack task management app with a coin-based reward economy, buddy system with real-time sync, and a customizable cosmetic store (color themes, fonts, backgrounds, and mix-and-match sprite packs).

**Stack:** React + Vite (frontend, deployed on Vercel) · FastAPI (backend, deployed on Render) · PostgreSQL via Neon (production) / SQLite (local dev) · WebSockets for real-time sync

---

## Features

- **Tasks** — daily, weekly, and date-based tasks with optional repeats, private/shared visibility, and a 3-column layout
- **Coins & Store** — earn coins by completing tasks, spend them on color schemes, fonts, backgrounds, and sprite packs
- **Sprite packs** — three themed packs (Forest Friends, Space Explorer, Ocean Depths), each with 4 pieces (card, column, background overlay, profile). Pieces can be bought individually or as a discounted bundle; buying all 4 pieces separately automatically unlocks the full pack
- **Buddy system** — link accounts via invite code, share tasks, comment and react with emoji, see each other's shared/public tasks, and unlink at any time
- **Real-time sync** — buddy actions (complete/create/delete shared tasks) update both users live via WebSocket, no refresh needed
- **Themes** — light and dark ("Midnight") color schemes, with equipped sprites taking visual precedence over background themes where they overlap
- **Auth** — JWT-based authentication with bcrypt password hashing

---

## Project Structure

```
task-manager/
├── backend/
│   ├── main.py          # FastAPI app, all routes
│   ├── models.py        # SQLAlchemy models
│   ├── auth.py           # JWT + password hashing
│   ├── database.py       # DB session/engine setup (SQLite locally, Postgres in production)
│   ├── requirements.txt
│   └── tasks.db          # SQLite DB for local dev only (generated, gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main app, task columns, WebSocket listener
│   │   ├── Store.jsx       # Cosmetic store UI
│   │   ├── Profile.jsx     # User profile + sprite picker
│   │   ├── Buddy.jsx        # Buddy linking/unlinking UI
│   │   ├── TaskComments.jsx  # Comments/reactions
│   │   ├── Auth.jsx          # Login/register
│   │   └── theme.js           # Theme application logic
│   ├── public/sprites/         # Sprite pack images (card/column/bg_overlay/profile per pack)
│   └── asset-sources/          # Raw downloaded sprite packs (gitignored, not shipped)
└── README.md
```

---

## Setup (Local Development)

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend runs at `http://127.0.0.1:8000`. On first run, it automatically seeds the store (color schemes, fonts, backgrounds, sprite packs/pieces) and creates `tasks.db`.

By default, local dev uses SQLite (no setup needed). If you want to test against a real Postgres database locally, set `DATABASE_URL` before starting uvicorn:

```bash
export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
uvicorn main:app --reload
```

> **Note:** when `models.py` changes, create and apply an Alembic migration. Do not delete `tasks.db` or modify production tables manually.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. It reads the backend URL from `VITE_API_URL` (see `.env.local`), falling back to `http://127.0.0.1:8000` if unset.

### Running both

You'll need two terminals — one for `uvicorn`, one for `npm run dev`. Open `http://localhost:5173` in your browser once both are running.

---

## Deployment

This project is deployed using entirely free-tier services:

| Piece | Service | Notes |
|---|---|---|
| Backend (FastAPI + WebSockets) | [Render](https://render.com) | Free web service; root directory `backend`; start command `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Database | [Neon](https://neon.tech) | Free serverless Postgres; doesn't expire, auto-wakes on query |
| Frontend | [Vercel](https://vercel.com) | Free static hosting; root directory `frontend` |

**Environment variables needed:**

Backend (set in Render dashboard):
- `DATABASE_URL` — your Neon connection string
- `SECRET_KEY` — a strong random secret (generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`), never reuse a value that's ever been committed to git
- `GOOGLE_CLIENT_ID` — your Google OAuth client ID (see Google OAuth Setup below)

Frontend (set in Vercel dashboard):
- `VITE_API_URL` — your deployed Render backend URL (e.g. `https://your-app.onrender.com`)
- `VITE_GOOGLE_CLIENT_ID` — the **same** Google OAuth client ID as above. This must be prefixed with `VITE_` or Vite will silently strip it (and the entire Google button) out of the production build — it will not error, it will just be missing.

---

## Google OAuth Setup

1. In [Google Cloud Console](https://console.cloud.google.com), create a project and an OAuth client ID (Application type: **Web application**)
2. Under **Authorized JavaScript origins**, add every domain the app runs on: `http://localhost:5173` for local dev, plus your production frontend URL (e.g. `https://your-app.vercel.app`)
3. No redirect URIs needed — this uses Google Identity Services' token-based sign-in, not a redirect flow
4. Copy the generated Client ID (not a secret — safe to embed in frontend code) and set it as both `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend), as described above

Sign-in behavior:
- New Google account → creates a new user with no local password (`hashed_password` is `NULL`)
- Returning Google account → matched by `google_sub`, logs into the same account
- Google account whose **verified** email matches an existing password-based account → automatically links them (adds `google_sub` to that existing user), so the same email can sign in either way going forward

---

## Database Migrations

Schema changes are managed with [Alembic](https://alembic.sqlalchemy.org), not `create_all()`. To apply pending migrations:

```bash
cd backend
alembic upgrade head
```

By default this targets your local SQLite database. To run migrations against production (Neon), set `DATABASE_URL` first:

```bash
export DATABASE_URL="your-neon-connection-string"
alembic upgrade head
```

When adding a new model field, generate a migration rather than editing the database directly:

```bash
alembic revision --autogenerate -m "describe the change"
```

**Review the generated migration file before running it** — autogenerate is a starting point, not guaranteed correct, especially for SQLite (which has limited `ALTER TABLE` support and often needs Alembic's "batch mode" to work, as used in the `google_sub` migration for reference).

---

## Admin Tasks

**Deleting a user** (e.g. test accounts, spam signups) safely across every table that references them (tasks, purchases, comments, buddy links, app state) in one transaction:

```bash
cd backend
python delete.py <username>
```

In production, run this from Render's Shell (Dashboard → your service → Shell tab), from the `backend` directory.

---
## Testing the Buddy / Real-Time Features

1. Register two accounts (e.g. in two separate browser windows, or one normal + one incognito)
2. From one account, go to the Buddy tab and generate an invite code
3. From the second account, enter that code to link
4. Create a shared task from either account — it should appear for both, and completing/deleting it from either side updates the other live via WebSocket, no refresh required
5. Either account can unlink the buddy connection at any time from the Buddy tab

---

## Store Economy Notes

- Sprite pieces are priced at roughly `pack_cost / 4`
- Buying a pack directly charges `(sum of missing piece costs) × 0.8` (20% off), and grants any pieces you don't already own
- Buying all 4 pieces individually auto-grants the pack for free (no double-charging)
- Equipped sprites override the corresponding color-scheme background (e.g. equipping a column sprite hides the column background color/gradient) so the two don't visually layer

---

## Known Limitations

- No password reset flow for local (email/password) accounts. Google OAuth accounts sidestep this since Google handles their own account recovery, but a user who registered with a password and forgot it currently has no self-service recovery path.
- No notification/email digest system — considered for this project but scoped out as disproportionate effort (transactional email service, scheduling infrastructure, timezone handling) relative to portfolio value.
- WebSocket auth passes the JWT as a query parameter (`?token=...`) since browser WebSockets can't send custom headers — fine for a portfolio/local project, but for production you'd want a more robust scheme (short-lived ticket tokens, etc.)
- Render's free tier spins down after inactivity, causing a cold-start delay on the first request after idle periods
- Vite only exposes environment variables prefixed with `VITE_` to frontend code — an unprefixed variable is silently treated as undefined and any code gated behind it gets dead-code-eliminated from the production build with no error. Worth knowing if a feature "disappears" in production despite working locally.
- Sprite pack art is sourced from [Kenney.nl](https://kenney.nl) (CC0 license, free for commercial use, no attribution required)

---

## Version History

- **v1.0** — Initial full feature set: tasks, coins/store, JWT auth, buddy system, sprite packs
- **v1.1** — Real-time WebSocket sync for buddy actions, dark mode, buddy task permission fixes, various bug fixes
- **v1.2** — Deployed live (Render + Neon + Vercel), mix-and-match sprite piece purchasing with dynamic pack discounts
- **v1.3** — Improved mobile UX: tab-switching daily/weekly/date columns on narrow screens, responsive Store modal sizing, verified end-to-end on real mobile devices
- **v1.4** — Google OAuth login (auto-links to existing accounts via verified email), Alembic migrations for schema changes, safe administrative user-deletion script

---

## License

Sprite assets: CC0 1.0 (Kenney.nl). Project code: add your preferred license here.