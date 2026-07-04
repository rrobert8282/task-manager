from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date
import json
from database import get_db, engine, SessionLocal
import models
import auth
import secrets
import json
import jwt
from fastapi import WebSocket, WebSocketDisconnect



models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helpers ---
def get_state(user_id: int, db: Session) -> models.AppState:
    state = db.query(models.AppState).filter(models.AppState.user_id == user_id).first()
    if not state:
        state = models.AppState(coins=100, user_id=user_id)
        db.add(state)
        db.commit()
        db.refresh(state)
    return state

# --- Auth schemas ---
class RegisterSchema(BaseModel):
    email:    str
    password: str
    username: str

class TokenSchema(BaseModel):
    access_token: str
    token_type:   str
    username:     str
    email:        str

# --- Auth routes ---
@app.post("/auth/register", response_model=TokenSchema)
def register(data: RegisterSchema, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=data.email,
        username=data.username,
        hashed_password=auth.hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    get_state(user.id, db)
    token = auth.create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username, "email": user.email}

@app.post("/auth/login", response_model=TokenSchema)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not auth.verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth.create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username, "email": user.email}

@app.get("/auth/me")
def me(current_user: models.User = Depends(auth.get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "username": current_user.username}

# --- Task schemas ---
class TaskCreate(BaseModel):
    title:       str
    description: str = ""
    task_type:   models.TaskType = models.TaskType.daily
    repeats:     bool = False
    due_date:    Optional[date] = None
    is_private:  bool = False
    is_shared:   bool = False

class TaskUpdate(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None
    done:        Optional[bool] = None
    repeats:     Optional[bool] = None
    due_date:    Optional[date] = None
    is_private:  Optional[bool] = None
    is_shared:   Optional[bool] = None

# --- Task routes ---
@app.get("/tasks")
def get_tasks(
    task_type: Optional[str] = None,
    is_shared: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Task).filter(models.Task.user_id == current_user.id)
    if task_type:
        query = query.filter(models.Task.task_type == task_type)
    if is_shared is not None:
        query = query.filter(models.Task.is_shared == is_shared)
    return query.all()

@app.post("/tasks", status_code=201)
async def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    new_task = models.Task(**task.dict(), user_id=current_user.id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    await notify_task_change(current_user.id, db)
    return new_task

@app.patch("/tasks/{task_id}")
async def update_task(
    task_id: int,
    task: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not user_can_modify_task(db_task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    for key, value in task.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    await notify_task_change(current_user.id, db)
    return db_task

@app.patch("/tasks/{task_id}/complete")
async def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not user_can_modify_task(db_task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    db_task.done = True
    db_task.last_completed = date.today()
    state = get_state(current_user.id, db)
    state.coins += 10
    db.commit()
    db.refresh(db_task)
    await notify_task_change(current_user.id, db)
    return {"task": {"id": db_task.id, "done": db_task.done}, "coins_earned": 10, "total_coins": state.coins}

@app.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not user_can_modify_task(db_task, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")
    owner_id = db_task.user_id
    db.delete(db_task)
    db.commit()
    await notify_task_change(owner_id, db)

# --- Store routes ---
@app.get("/store/items")
def get_store_items(item_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.StoreItem)
    if item_type:
        query = query.filter(models.StoreItem.item_type == item_type)
    return query.all()

@app.on_event("startup")
def seed_store():
    db = SessionLocal()
    try:
        exists = db.query(models.StoreItem).filter(
            models.StoreItem.item_type == models.ItemType.color_scheme
        ).first()
        if exists:
            return
        items = [
        models.StoreItem(name="Default",  description="Classic clean look",   item_type=models.ItemType.color_scheme, cost=0,   css_value='{"--app-accent":"#3b82f6","--column-bg":"#ffffff","--task-bg":"#f9fafb","--text-primary":"#111827","--text-secondary":"#6b7280","--text-muted":"#9ca3af","--border":"#e5e7eb","--form-bg":"#f9fafb","--surface":"#ffffff","--app-bg":"#f3f4f6"}', preview="#3b82f6"),
        models.StoreItem(name="Forest",   description="Calm green tones",     item_type=models.ItemType.color_scheme, cost=0,   css_value='{"--app-accent":"#16a34a","--column-bg":"#dcfce7","--task-bg":"#f0fdf4","--text-primary":"#14532d","--text-secondary":"#166534","--text-muted":"#4ade80","--border":"#86efac","--form-bg":"#dcfce7","--surface":"#dcfce7","--app-bg":"#f0fdf4"}', preview="#16a34a"),
        models.StoreItem(name="Sunset",   description="Warm orange and pink", item_type=models.ItemType.color_scheme, cost=50,  css_value='{"--app-accent":"#f97316","--column-bg":"#ffedd5","--task-bg":"#fff7ed","--text-primary":"#7c2d12","--text-secondary":"#9a3412","--text-muted":"#fb923c","--border":"#fed7aa","--form-bg":"#ffedd5","--surface":"#ffedd5","--app-bg":"#fff7ed"}', preview="#f97316"),
        models.StoreItem(name="Midnight", description="Dark mode vibes",      item_type=models.ItemType.color_scheme, cost=50,  css_value='{"--app-accent":"#818cf8","--column-bg":"#1e293b","--task-bg":"#0f172a","--text-primary":"#f1f5f9","--text-secondary":"#94a3b8","--text-muted":"#64748b","--border":"#334155","--form-bg":"#1e293b","--surface":"#1e293b","--app-bg":"#0f172a"}', preview="#818cf8"),
        models.StoreItem(name="Rose",     description="Soft pink palette",    item_type=models.ItemType.color_scheme, cost=100, css_value='{"--app-accent":"#e11d48","--column-bg":"#ffe4e6","--task-bg":"#fff1f2","--text-primary":"#881337","--text-secondary":"#9f1239","--text-muted":"#fb7185","--border":"#fecdd3","--form-bg":"#ffe4e6","--surface":"#ffe4e6","--app-bg":"#fff1f2"}', preview="#e11d48"),
        models.StoreItem(name="Default Sans", description="Clean system font",   item_type=models.ItemType.font, cost=0,   css_value="system-ui, sans-serif",       preview="Aa"),
        models.StoreItem(name="Roboto",       description="Modern and readable", item_type=models.ItemType.font, cost=0,   css_value="'Roboto', sans-serif",         preview="Aa"),
        models.StoreItem(name="Playfair",     description="Elegant serif",       item_type=models.ItemType.font, cost=75,  css_value="'Playfair Display', serif",    preview="Aa"),
        models.StoreItem(name="Space Mono",   description="Techy monospace",     item_type=models.ItemType.font, cost=75,  css_value="'Space Mono', monospace",      preview="Aa"),
        models.StoreItem(name="Pacifico",     description="Fun and friendly",    item_type=models.ItemType.font, cost=100, css_value="'Pacifico', cursive",          preview="Aa"),
        models.StoreItem(name="Clean",     description="No background",      item_type=models.ItemType.app_bg, cost=0,   css_value="none",                                                      preview="#ffffff"),
        models.StoreItem(name="Soft Grid", description="Subtle dot grid",    item_type=models.ItemType.app_bg, cost=0,   css_value="radial-gradient(circle, #e5e7eb 1px, transparent 1px)",   preview="#e5e7eb"),
        models.StoreItem(name="Aurora",    description="Gradient sky",       item_type=models.ItemType.app_bg, cost=150, css_value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)",        preview="linear-gradient(135deg,#667eea,#764ba2)"),
        models.StoreItem(name="Ocean",     description="Deep blue gradient", item_type=models.ItemType.app_bg, cost=150, css_value="linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)",        preview="linear-gradient(135deg,#0093E9,#80D0C7)"),
        models.StoreItem(name="Plain",     description="Default column style", item_type=models.ItemType.column_bg, cost=0, css_value="none", preview="#ffffff"),
        models.StoreItem(name="Plain row", description="Default task style",   item_type=models.ItemType.task_bg,   cost=0, css_value="none", preview="#ffffff"),
    ]
        db.add_all(items)
        db.commit()
    finally:
        db.close()
    return {"message": "seeded", "count": len(items)}

# --- State routes ---

# --- WebSocket connection manager ---
class ConnectionManager:
    def __init__(self):
        # user_id -> list of active WebSocket connections (a user could have multiple tabs open)
        self.active: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        conns = self.active.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns and user_id in self.active:
            del self.active[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        for ws in self.active.get(user_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass  # connection likely dead, will be cleaned up on disconnect

manager = ConnectionManager()


async def notify_task_change(user_id: int, db: Session):
    """Notify a user and their buddy (if connected) that task data changed."""
    await manager.send_to_user(user_id, {"type": "tasks_changed"})
    buddy = get_buddy(user_id, db)
    if buddy:
        await manager.send_to_user(buddy.id, {"type": "tasks_changed"})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username = payload.get("sub")
        if not username:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            await websocket.close(code=1008)
            return
        user_id = user.id
    finally:
        db.close()

    await manager.connect(user_id, websocket)
    try:
        while True:
            # We don't expect messages from the client, just keep the connection open.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)

@app.get("/state")
def get_app_state(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    state = get_state(current_user.id, db)
    return {"coins": state.coins, "equipped": json.loads(state.equipped_json)}

def _pack_pieces(db: Session, pack_key: str):
    """All sprite_piece StoreItems belonging to a given pack key."""
    pieces = db.query(models.StoreItem).filter(
        models.StoreItem.item_type == models.ItemType.sprite_piece
    ).all()
    return [p for p in pieces if json.loads(p.meta).get("pack") == pack_key]


def _owned_item_ids(db: Session, user_id: int, item_ids: list[int]) -> set[int]:
    if not item_ids:
        return set()
    rows = db.query(models.Purchase).filter(
        models.Purchase.user_id == user_id,
        models.Purchase.item_id.in_(item_ids)
    ).all()
    return {r.item_id for r in rows}


def _maybe_grant_pack(db: Session, user_id: int, pack_key: str):
    """If the user now owns all pieces of a pack, grant the pack itself for free."""
    pack_item = db.query(models.StoreItem).filter(
        models.StoreItem.item_type == models.ItemType.sprite_pack
    ).all()
    pack_item = next((p for p in pack_item if json.loads(p.meta).get("pack") == pack_key), None)
    if not pack_item:
        return
    already_pack = db.query(models.Purchase).filter(
        models.Purchase.item_id == pack_item.id,
        models.Purchase.user_id == user_id
    ).first()
    if already_pack:
        return
    pieces = _pack_pieces(db, pack_key)
    owned = _owned_item_ids(db, user_id, [p.id for p in pieces])
    if pieces and all(p.id in owned for p in pieces):
        db.add(models.Purchase(item_id=pack_item.id, user_id=user_id))
        db.commit()


@app.post("/store/buy/{item_id}")
def buy_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = db.query(models.StoreItem).filter(models.StoreItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    already = db.query(models.Purchase).filter(
        models.Purchase.item_id == item_id,
        models.Purchase.user_id == current_user.id
    ).first()
    if already:
        return {"message": "already owned"}
    state = get_state(current_user.id, db)

    if item.item_type == models.ItemType.sprite_pack:
        meta = json.loads(item.meta)
        pack_key = meta["pack"]
        pieces = _pack_pieces(db, pack_key)
        owned = _owned_item_ids(db, current_user.id, [p.id for p in pieces])
        missing = [p for p in pieces if p.id not in owned]
        raw_sum = sum(p.cost for p in missing)
        effective_cost = round(raw_sum * SPRITE_PACK_DISCOUNT)
        if effective_cost > 0 and state.coins < effective_cost:
            raise HTTPException(status_code=400, detail="Not enough coins")
        state.coins -= effective_cost
        for p in missing:
            db.add(models.Purchase(item_id=p.id, user_id=current_user.id))
        db.add(models.Purchase(item_id=item_id, user_id=current_user.id))
        db.commit()
        return {"message": "purchased", "coins": state.coins, "price_paid": effective_cost}

    if item.cost > 0 and state.coins < item.cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    state.coins -= item.cost
    db.add(models.Purchase(item_id=item_id, user_id=current_user.id))
    db.commit()

    if item.item_type == models.ItemType.sprite_piece:
        pack_key = json.loads(item.meta)["pack"]
        _maybe_grant_pack(db, current_user.id, pack_key)

    return {"message": "purchased", "coins": state.coins}

@app.get("/store/inventory")
def get_inventory(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    purchases = db.query(models.Purchase).filter(models.Purchase.user_id == current_user.id).all()
    item_ids = [p.item_id for p in purchases]
    return db.query(models.StoreItem).filter(models.StoreItem.id.in_(item_ids)).all()

@app.post("/store/equip/{item_id}")
def equip_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = db.query(models.StoreItem).filter(models.StoreItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    owned = db.query(models.Purchase).filter(
        models.Purchase.item_id == item_id,
        models.Purchase.user_id == current_user.id
    ).first()
    if not owned and item.cost > 0:
        raise HTTPException(status_code=403, detail="Item not owned")
    state = get_state(current_user.id, db)
    equipped = json.loads(state.equipped_json)
    equipped[item.item_type.value] = item_id
    state.equipped_json = json.dumps(equipped)
    db.commit()
    return {"message": "equipped", "equipped": equipped}

def get_buddy(user_id: int, db: Session):
    """Return the User object of user_id's buddy, or None."""
    link = db.query(models.BuddyLink).filter(
        (models.BuddyLink.user_a_id == user_id) |
        (models.BuddyLink.user_b_id == user_id)
    ).first()
    if not link:
        return None
    buddy_id = link.user_b_id if link.user_a_id == user_id else link.user_a_id
    return db.query(models.User).filter(models.User.id == buddy_id).first()


def user_can_modify_task(task: models.Task, current_user: models.User, db: Session) -> bool:
    """True if current_user owns the task, or the task belongs to their
    buddy and is marked shared."""
    if task.user_id == current_user.id:
        return True
    buddy = get_buddy(current_user.id, db)
    if buddy and task.user_id == buddy.id and task.is_shared:
        return True
    return False


# ── Buddy routes ───────────────────────────────────────────────────────────────

@app.post("/buddy/invite")
def create_invite(
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if get_buddy(current_user.id, db):
        raise HTTPException(400, "You already have a buddy")
    # Invalidate any previous unused invite from this user
    db.query(models.BuddyInvite).filter(
        models.BuddyInvite.sender_id == current_user.id,
        models.BuddyInvite.used == False
    ).delete()
    invite = models.BuddyInvite(
        code=secrets.token_urlsafe(8),
        sender_id=current_user.id
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return {"code": invite.code}


class AcceptSchema(BaseModel):
    code: str

@app.post("/buddy/accept")
def accept_invite(
    body: AcceptSchema,
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if get_buddy(current_user.id, db):
        raise HTTPException(400, "You already have a buddy")
    invite = db.query(models.BuddyInvite).filter(
        models.BuddyInvite.code == body.code,
        models.BuddyInvite.used == False
    ).first()
    if not invite:
        raise HTTPException(404, "Invalid or expired invite code")
    if invite.sender_id == current_user.id:
        raise HTTPException(400, "You cannot accept your own invite")
    if get_buddy(invite.sender_id, db):
        raise HTTPException(400, "That user already has a buddy")

    link = models.BuddyLink(user_a_id=invite.sender_id, user_b_id=current_user.id)
    invite.used = True
    db.add(link)
    db.commit()

    sender = db.query(models.User).filter(models.User.id == invite.sender_id).first()
    return {"message": "Buddy linked!", "buddy": sender.username}


@app.get("/buddy")
def get_my_buddy(
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    buddy = get_buddy(current_user.id, db)
    if not buddy:
        return {"buddy": None}
    return {"buddy": {"id": buddy.id, "username": buddy.username}}


@app.delete("/buddy")
def unlink_buddy(
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    link = db.query(models.BuddyLink).filter(
        (models.BuddyLink.user_a_id == current_user.id) |
        (models.BuddyLink.user_b_id == current_user.id)
    ).first()
    if not link:
        raise HTTPException(404, "No buddy to unlink")
    db.delete(link)
    db.commit()
    return {"message": "Buddy unlinked"}


@app.get("/buddy/tasks")
def get_buddy_tasks(
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    buddy = get_buddy(current_user.id, db)
    if not buddy:
        raise HTTPException(404, "No buddy linked")
    tasks = db.query(models.Task).filter(
        models.Task.user_id == buddy.id,
        models.Task.is_private == False,
        models.Task.is_shared == False
    ).all() 
    return tasks

@app.get("/buddy/shared")
def get_buddy_shared_tasks(
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    buddy = get_buddy(current_user.id, db)
    if not buddy:
        return []
    return db.query(models.Task).filter(
        models.Task.user_id == buddy.id,
        models.Task.is_shared == True
    ).all()
# ── Comment routes ─────────────────────────────────────────────────────────────

class CommentSchema(BaseModel):
    emoji: str | None = None
    text:  str | None = None

@app.post("/tasks/{task_id}/comments")
def add_comment(
    task_id: int,
    body: CommentSchema,
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    buddy = get_buddy(current_user.id, db)
    # Can only comment on your buddy's public tasks
    if not buddy or task.user_id != buddy.id or task.is_private:
        raise HTTPException(403, "Cannot comment on this task")
    comment = models.TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        emoji=body.emoji,
        text=body.text
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.get("/tasks/{task_id}/comments")
def get_comments(
    task_id: int,
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    buddy = get_buddy(current_user.id, db)
    buddy_id = buddy.id if buddy else None
    # Must be your own task or your buddy's public task
    if task.user_id != current_user.id and (not buddy or task.user_id != buddy_id or task.is_private):
        raise HTTPException(403, "Cannot view comments on this task")
    return db.query(models.TaskComment).filter(
        models.TaskComment.task_id == task_id
    ).all()

# ── Sprite pack seeder ─────────────────────────────────────────────────────────
# Pack definitions: base data used to derive both piece prices and pack price.
SPRITE_PACK_DEFS = {
    "forest": {
        "display_name": "Forest Friends",
        "description": "Woodland creatures for your tasks",
        "base_cost": 150,
    },
    "space": {
        "display_name": "Space Explorer",
        "description": "Cosmic vibes across your workspace",
        "base_cost": 200,
    },
    "ocean": {
        "display_name": "Ocean Depths",
        "description": "Deep sea creatures for deep focus",
        "base_cost": 175,
    },
}
SPRITE_PACK_DISCOUNT = 0.8  # 20% off when buying remaining pieces as part of a pack


def sprite_piece_price(base_cost: int) -> int:
    return round(base_cost / 4)


@app.on_event("startup")
def seed_sprite_packs():
    db = SessionLocal()
    try:
        exists = db.query(models.StoreItem).filter(
            models.StoreItem.item_type == models.ItemType.sprite_pack
        ).first()
        if exists:
            return

        rows = []
        for pack_key, info in SPRITE_PACK_DEFS.items():
            piece_price = sprite_piece_price(info["base_cost"])
            sprites = {
                "card":       f"{pack_key}/card.png",
                "column":     f"{pack_key}/column.png",
                "bg_overlay": f"{pack_key}/bg_overlay.png",
                "profile":    f"{pack_key}/profile.png",
            }

            # Individual pieces
            for slot, path in sprites.items():
                rows.append(models.StoreItem(
                    name=f"{info['display_name']} - {slot.replace('_', ' ').title()}",
                    description=f"{slot.replace('_', ' ').title()} piece from {info['display_name']}",
                    cost=piece_price,
                    item_type=models.ItemType.sprite_piece,
                    css_value="",
                    meta=json.dumps({"pack": pack_key, "slot": slot, "path": path}),
                ))

            # Pack bundle row — baseline price shown when user owns none of its pieces
            bundle_baseline = round(piece_price * 4 * SPRITE_PACK_DISCOUNT)
            rows.append(models.StoreItem(
                name=info["display_name"],
                description=info["description"],
                cost=bundle_baseline,
                item_type=models.ItemType.sprite_pack,
                css_value="",
                meta=json.dumps({
                    "pack": pack_key,
                    "preview": sprites["profile"],
                    "sprites": sprites,
                }),
            ))

        db.add_all(rows)
        db.commit()
    finally:
        db.close()


# ── Sprite equip route ─────────────────────────────────────────────────────────
class EquipSpriteSchema(BaseModel):
    item_id: int   # id of an owned sprite_piece StoreItem

VALID_SLOTS = {"card", "column", "bg_overlay", "profile"}

@app.post("/store/equip-sprite")
def equip_sprite(
    body: EquipSpriteSchema,
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(models.StoreItem).filter(models.StoreItem.id == body.item_id).first()
    if not item or item.item_type != models.ItemType.sprite_piece:
        raise HTTPException(404, "Sprite piece not found")

    purchase = db.query(models.Purchase).filter(
        models.Purchase.user_id == current_user.id,
        models.Purchase.item_id == body.item_id
    ).first()
    if not purchase:
        raise HTTPException(403, "You don't own this sprite piece")

    meta = json.loads(item.meta)
    slot = meta.get("slot")
    sprite_path = meta.get("path")
    if slot not in VALID_SLOTS or not sprite_path:
        raise HTTPException(400, "This piece has invalid slot/path metadata")

    # Update equipped state
    state = get_state(current_user.id, db)
    equipped = json.loads(state.equipped_json) if state.equipped_json else {}
    equipped[f"{slot}_sprite"] = sprite_path
    state.equipped_json = json.dumps(equipped)
    db.commit()

    return {"equipped": equipped}