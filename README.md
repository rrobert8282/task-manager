# Task Manager

A full-stack task manager with a FastAPI backend and React frontend. Supports daily, weekly, and date-based tasks, a buddy sharing system, and a cosmetic store with a coin reward system.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **Frontend:** React, Vite, Axios

## Project Structure

```
task-manager/
├── backend/
│   ├── main.py        # API routes
│   ├── models.py      # Database models
│   └── database.py    # DB connection
└── frontend/
    └── src/
        ├── App.jsx    # Main app + columns
        ├── Store.jsx  # Store + inventory UI
        ├── theme.js   # Theme engine
        └── theme.css  # CSS variables
```

## Setup

### Requirements

- Python 3.10+
- Node.js 20+
- Git

### Backend

```bash
# From project root
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy pydantic

cd backend
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`  
Interactive API docs at `http://127.0.0.1:8000/docs`

Seed the store on first run:

```bash
curl -X POST http://127.0.0.1:8000/store/seed
```

### Frontend

```bash
# In a second terminal, from project root
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Features

### Tasks
- Three task types: **Daily**, **Weekly**, **Date**
- Daily tasks can be set to repeat automatically each day
- Tasks can be marked private or shared with a buddy
- 10 coins earned per completed task

### Store
- Buy and equip color schemes, fonts, and backgrounds
- Owned items live in your inventory — equip and swap freely
- New users start with 100 coins

### Shared Tasks
- Separate column set for tasks shared with a buddy
- Either user can mark shared tasks as done

## Notes

- The database file (`tasks.db`) is not tracked by Git — each machine starts fresh
- Coins, inventory, and equipped items persist in the local database
- A hosted database will replace SQLite in a future update when auth is added

## Roadmap

- [x] Phase 1 — Daily, weekly, date tasks + 3-column layout
- [x] Phase 2 — Store, inventory, coin system, themes
- [ ] Phase 3 — Email auth + user accounts
- [ ] Phase 4 — Buddy system + shared tasks
- [ ] Phase 5 — Store expansion + sprite packs
