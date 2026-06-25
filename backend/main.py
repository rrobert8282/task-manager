from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
import json
from database import get_db, engine
import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helpers ---
def get_state(db: Session) -> models.AppState:
    state = db.query(models.AppState).first()
    if not state:
        state = models.AppState(coins = 100)
        db.add(state)
        db.commit()
        db.refresh(state)
    return state

# --- Schemas ---
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
def get_tasks(task_type: Optional[str] = None, is_shared: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(models.Task)
    if task_type:
        query = query.filter(models.Task.task_type == task_type)
    if is_shared is not None:
        query = query.filter(models.Task.is_shared == is_shared)
    return query.all()

@app.post("/tasks", status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    new_task = models.Task(**task.dict())
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.patch("/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in task.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.patch("/tasks/{task_id}/complete")
def complete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db_task.done = True
    db_task.last_completed = date.today()
    state = get_state(db)
    state.coins += 10
    db.commit()
    db.refresh(db_task)
    return {"task": {"id": db_task.id, "done": db_task.done}, "coins_earned": 10, "total_coins": state.coins}

@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
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
    # Color schemes — only colors, no backgrounds
    models.StoreItem(name="Default",  description="Classic clean look",   item_type=models.ItemType.color_scheme, cost=0,   css_value='{"--app-accent":"#3b82f6","--column-bg":"#ffffff","--task-bg":"#f9fafb","--text-primary":"#111827","--text-secondary":"#6b7280","--text-muted":"#9ca3af","--border":"#e5e7eb","--form-bg":"#f9fafb","--surface":"#ffffff","--app-bg":"#f3f4f6"}', preview="#3b82f6"),
    models.StoreItem(name="Forest",   description="Calm green tones",     item_type=models.ItemType.color_scheme, cost=0,   css_value='{"--app-accent":"#16a34a","--column-bg":"#dcfce7","--task-bg":"#f0fdf4","--text-primary":"#14532d","--text-secondary":"#166534","--text-muted":"#4ade80","--border":"#86efac","--form-bg":"#dcfce7","--surface":"#dcfce7","--app-bg":"#f0fdf4"}', preview="#16a34a"),
    models.StoreItem(name="Sunset",   description="Warm orange and pink", item_type=models.ItemType.color_scheme, cost=50,  css_value='{"--app-accent":"#f97316","--column-bg":"#ffedd5","--task-bg":"#fff7ed","--text-primary":"#7c2d12","--text-secondary":"#9a3412","--text-muted":"#fb923c","--border":"#fed7aa","--form-bg":"#ffedd5","--surface":"#ffedd5","--app-bg":"#fff7ed"}', preview="#f97316"),
    models.StoreItem(name="Midnight", description="Dark mode vibes",      item_type=models.ItemType.color_scheme, cost=50,  css_value='{"--app-accent":"#818cf8","--column-bg":"#1e293b","--task-bg":"#0f172a","--text-primary":"#f1f5f9","--text-secondary":"#94a3b8","--text-muted":"#64748b","--border":"#334155","--form-bg":"#1e293b","--surface":"#1e293b","--app-bg":"#0f172a"}', preview="#818cf8"),
    models.StoreItem(name="Rose",     description="Soft pink palette",    item_type=models.ItemType.color_scheme, cost=100, css_value='{"--app-accent":"#e11d48","--column-bg":"#ffe4e6","--task-bg":"#fff1f2","--text-primary":"#881337","--text-secondary":"#9f1239","--text-muted":"#fb7185","--border":"#fecdd3","--form-bg":"#ffe4e6","--surface":"#ffe4e6","--app-bg":"#fff1f2"}', preview="#e11d48"),
    # Fonts
    models.StoreItem(name="Default Sans", description="Clean system font",   item_type=models.ItemType.font, cost=0,   css_value="system-ui, sans-serif",       preview="Aa"),
    models.StoreItem(name="Roboto",       description="Modern and readable", item_type=models.ItemType.font, cost=0,   css_value="'Roboto', sans-serif",         preview="Aa"),
    models.StoreItem(name="Playfair",     description="Elegant serif",       item_type=models.ItemType.font, cost=75,  css_value="'Playfair Display', serif",    preview="Aa"),
    models.StoreItem(name="Space Mono",   description="Techy monospace",     item_type=models.ItemType.font, cost=75,  css_value="'Space Mono', monospace",      preview="Aa"),
    models.StoreItem(name="Pacifico",     description="Fun and friendly",    item_type=models.ItemType.font, cost=100, css_value="'Pacifico', cursive",          preview="Aa"),
    # App backgrounds — independent from color schemes
    models.StoreItem(name="Clean",    description="No background",       item_type=models.ItemType.app_bg, cost=0,   css_value="none",                                                        preview="#ffffff"),
    models.StoreItem(name="Soft Grid",description="Subtle dot grid",     item_type=models.ItemType.app_bg, cost=0,   css_value="radial-gradient(circle, #e5e7eb 1px, transparent 1px)",     preview="#e5e7eb"),
    models.StoreItem(name="Aurora",   description="Gradient sky",        item_type=models.ItemType.app_bg, cost=150, css_value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)",          preview="linear-gradient(135deg,#667eea,#764ba2)"),
    models.StoreItem(name="Ocean",    description="Deep blue gradient",  item_type=models.ItemType.app_bg, cost=150, css_value="linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)",          preview="linear-gradient(135deg,#0093E9,#80D0C7)"),
    # Column decorations — placeholder, drop your assets in later
    models.StoreItem(name="Plain",       description="Default column style", item_type=models.ItemType.column_bg, cost=0,   css_value="none",    preview="#ffffff", is_animated=False),
    models.StoreItem(name="Custom GIF",  description="Upload your own GIF",  item_type=models.ItemType.column_bg, cost=0,   css_value="none",    preview="#e5e7eb", is_animated=True),
    # Task row decorations — placeholder
    models.StoreItem(name="Plain row",   description="Default task style",   item_type=models.ItemType.task_bg,   cost=0,   css_value="none",    preview="#ffffff", is_animated=False),
]
    db.add_all(items)
    db.commit()
    return {"message": "seeded", "count": len(items)}

# --- App state routes (coins + equipped) ---
@app.get("/state")
def get_app_state(db: Session = Depends(get_db)):
    state = get_state(db)
    return {"coins": state.coins, "equipped": json.loads(state.equipped_json)}

@app.post("/store/buy/{item_id}")
def buy_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.StoreItem).filter(models.StoreItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    already = db.query(models.Purchase).filter(models.Purchase.item_id == item_id).first()
    if already:
        return {"message": "already owned"}
    state = get_state(db)
    if item.cost > 0 and state.coins < item.cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    state.coins -= item.cost
    db.add(models.Purchase(item_id=item_id))
    db.commit()
    return {"message": "purchased", "coins": state.coins}

@app.get("/store/inventory")
def get_inventory(db: Session = Depends(get_db)):
    purchases = db.query(models.Purchase).all()
    item_ids = [p.item_id for p in purchases]
    items = db.query(models.StoreItem).filter(models.StoreItem.id.in_(item_ids)).all()
    return items

@app.post("/store/equip/{item_id}")
def equip_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.StoreItem).filter(models.StoreItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    owned = db.query(models.Purchase).filter(models.Purchase.item_id == item_id).first()
    if not owned and item.cost > 0:
        raise HTTPException(status_code=403, detail="Item not owned")
    state = get_state(db)
    equipped = json.loads(state.equipped_json)
    equipped[item.item_type.value] = item_id
    state.equipped_json = json.dumps(equipped)
    db.commit()
    return {"message": "equipped", "equipped": equipped}