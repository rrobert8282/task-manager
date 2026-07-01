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
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    new_task = models.Task(**task.dict(), user_id=current_user.id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.patch("/tasks/{task_id}")
def update_task(
    task_id: int,
    task: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == current_user.id
    ).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in task.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.patch("/tasks/{task_id}/complete")
def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == current_user.id
    ).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db_task.done = True
    db_task.last_completed = date.today()
    state = get_state(current_user.id, db)
    state.coins += 10
    db.commit()
    db.refresh(db_task)
    return {"task": {"id": db_task.id, "done": db_task.done}, "coins_earned": 10, "total_coins": state.coins}

@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == current_user.id
    ).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()

# --- Store routes ---
@app.get("/store/items")
def get_store_items(item_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.StoreItem)
    if item_type:
        query = query.filter(models.StoreItem.item_type == item_type)
    return query.all()

@app.post("/store/seed", status_code=201)
def seed_store(db: Session = Depends(get_db)):
    if db.query(models.StoreItem).count() > 0:
        return {"message": "already seeded"}
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
    return {"message": "seeded", "count": len(items)}

# --- State routes ---
@app.get("/state")
def get_app_state(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    state = get_state(current_user.id, db)
    return {"coins": state.coins, "equipped": json.loads(state.equipped_json)}

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
    if item.cost > 0 and state.coins < item.cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    state.coins -= item.cost
    db.add(models.Purchase(item_id=item_id, user_id=current_user.id))
    db.commit()
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
@app.on_event("startup")
def seed_sprite_packs():
    db = SessionLocal()
    try:
        exists = db.query(models.StoreItem).filter(
            models.StoreItem.item_type == "sprite_pack"
        ).first()
        if exists:
            return
        packs = [
            models.StoreItem(
                name="Forest Friends",
                description="Woodland creatures for your tasks",
                cost=150,
                item_type=models.ItemType.sprite_pack,
                css_value="",
                meta=json.dumps({
                    "preview": "forest/profile.gif",
                    "sprites": {
                        "card":       "forest/card.gif",
                        "column":     "forest/column.gif",
                        "bg_overlay": "forest/overlay.gif",
                        "profile":    "forest/profile.gif",
                    }
                })
            ),
            models.StoreItem(
                name="Space Explorer",
                description="Cosmic vibes across your workspace",
                cost=200,
                item_type=models.ItemType.sprite_pack,
                css_value="",
                meta=json.dumps({
                    "preview": "space/profile.gif",
                    "sprites": {
                        "card":       "space/card.gif",
                        "column":     "space/column.gif",
                        "bg_overlay": "space/overlay.gif",
                        "profile":    "space/profile.gif",
                    }
                })
            ),
            models.StoreItem(
                name="Ocean Depths",
                description="Deep sea creatures for deep focus",
                cost=175,
                item_type=models.ItemType.sprite_pack,
                css_value="",
                meta=json.dumps({
                    "preview": "ocean/profile.gif",
                    "sprites": {
                        "card":       "ocean/card.gif",
                        "column":     "ocean/column.gif",
                        "bg_overlay": "ocean/overlay.gif",
                        "profile":    "ocean/profile.gif",
                    }
                })
            ),
        ]
        db.add_all(packs)
        db.commit()
    finally:
        db.close()


# ── Sprite equip route ─────────────────────────────────────────────────────────
class EquipSpriteSchema(BaseModel):
    pack_id: int
    slot: str   # card | column | bg_overlay | profile

VALID_SLOTS = {"card", "column", "bg_overlay", "profile"}

@app.post("/store/equip-sprite")
def equip_sprite(
    body: EquipSpriteSchema,
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if body.slot not in VALID_SLOTS:
        raise HTTPException(400, f"Invalid slot. Must be one of: {VALID_SLOTS}")

    # Check user owns this pack
    purchase = db.query(models.Purchase).filter(
        models.Purchase.user_id == current_user.id,
        models.Purchase.item_id == body.pack_id
    ).first()
    if not purchase:
        raise HTTPException(403, "You don't own this sprite pack")

    item = db.query(models.StoreItem).filter(models.StoreItem.id == body.pack_id).first()
    if not item or item.item_type != "sprite_pack":
        raise HTTPException(404, "Sprite pack not found")

    meta = json.loads(item.meta)
    sprite_path = meta["sprites"].get(body.slot)
    if not sprite_path:
        raise HTTPException(400, "This pack has no sprite for that slot")

    # Update equipped state
    state = get_state(current_user.id, db)
    equipped = json.loads(state.equipped_json) if state.equipped_json else {}
    equipped[f"{body.slot}_sprite"] = sprite_path
    state.equipped_json = json.dumps(equipped)
    db.commit()

    return {"equipped": equipped}