# Task Manager — Gamified Productivity App

A full-stack task management app with a coin-based reward economy, buddy system with real-time sync, and a customizable cosmetic store (color themes, fonts, backgrounds, and mix-and-match sprite packs).

**Stack:** React + Vite (frontend) · FastAPI + SQLite (backend) · WebSockets for real-time sync

---

## Features

- **Tasks** — daily, weekly, and date-based tasks with optional repeats, private/shared visibility, and a 3-column layout
- **Coins & Store** — earn coins by completing tasks, spend them on color schemes, fonts, backgrounds, and sprite packs
- **Sprite packs** — three themed packs (Forest Friends, Space Explorer, Ocean Depths), each with 4 pieces (card, column, background overlay, profile). Pieces can be bought individually or as a discounted bundle; buying all 4 pieces separately automatically unlocks the full pack
- **Buddy system** — link accounts via invite code, share tasks, comment and react with emoji, and see each other's shared/public tasks
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
│   ├── database.py       # DB session/engine setup
│   ├── requirements.txt
│   └── tasks.db          # SQLite DB (generated, gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main app, task columns, WebSocket listener
│   │   ├── Store.jsx       # Cosmetic store UI
│   │   ├── Profile.jsx     # User profile + sprite picker
│   │   ├── Buddy.jsx        # Buddy linking UI
│   │   ├── TaskComments.jsx  # Comments/reactions
│   │   ├── Auth.jsx          # Login/register
│   │   └── theme.js           # Theme application logic
│   ├── public/sprites/         # Sprite pack images (card/column/bg_overlay/profile per pack)
│   └── asset-sources/          # Raw downloaded sprite packs (gitignored, not shipped)
└── README.md
```

---

## Setup

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

> **Note:** if you ever change a model in `models.py`, SQLAlchemy's `create_all()` will **not** alter existing tables. Delete `tasks.db` and restart uvicorn to apply schema changes.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and expects the backend at `http://127.0.0.1:8000` (hardcoded in each component as `const API = "http://127.0.0.1:8000"`).

### Running both

You'll need two terminals — one for `uvicorn`, one for `npm run dev`. Open `http://localhost:5173` in your browser once both are running.

---

## Testing the Buddy / Real-Time Features

1. Register two accounts (e.g. in two separate browser windows, or one normal + one incognito)
2. From one account, go to the Buddy tab and generate an invite code
3. From the second account, enter that code to link
4. Create a shared task from either account — it should appear for both, and completing/deleting it from either side updates the other live via WebSocket, no refresh required

---

## Store Economy Notes

- Sprite pieces are priced at roughly `pack_cost / 4`
- Buying a pack directly charges `(sum of missing piece costs) × 0.8` (20% off), and grants any pieces you don't already own
- Buying all 4 pieces individually auto-grants the pack for free (no double-charging)
- Equipped sprites override the corresponding color-scheme background (e.g. equipping a column sprite hides the column background color/gradient) so the two don't visually layer

---

## Known Limitations

- WebSocket auth passes the JWT as a query parameter (`?token=...`) since browser WebSockets can't send custom headers — fine for a portfolio/local project, but for production you'd want a more robust scheme (short-lived ticket tokens, etc.)
- No password reset flow
- Sprite pack art is sourced from [Kenney.nl](https://kenney.nl) (CC0 license, free for commercial use, no attribution required)

---

## License

Sprite assets: CC0 1.0 (Kenney.nl). Project code: add your preferred license here.
