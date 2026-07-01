from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum, Date
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime

class TaskType(enum.Enum):
    daily  = "daily"
    weekly = "weekly"
    date   = "date"

class ItemType(enum.Enum):
    app_bg       = "app_bg"
    column_bg    = "column_bg"
    task_bg      = "task_bg"
    font         = "font"
    color_scheme = "color_scheme"

class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    username        = Column(String, nullable=False)
    tasks           = relationship("Task", back_populates="owner")
    purchases       = relationship("Purchase", back_populates="owner")
    app_state       = relationship("AppState", back_populates="owner", uselist=False)
    sent_invites = relationship("BuddyInvite", back_populates="sender")
    comments     = relationship("TaskComment", back_populates="author")

class Task(Base):
    __tablename__ = "tasks"
    id             = Column(Integer, primary_key=True, index=True)
    title          = Column(String, nullable=False)
    description    = Column(String, default="")
    done           = Column(Boolean, default=False)
    task_type      = Column(Enum(TaskType), nullable=False, default=TaskType.daily)
    repeats        = Column(Boolean, default=False)
    due_date       = Column(Date, nullable=True)
    is_private     = Column(Boolean, default=False)
    is_shared      = Column(Boolean, default=False)
    last_completed = Column(Date, nullable=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner          = relationship("User", back_populates="tasks")
    comments = relationship("TaskComment", back_populates="task")

class StoreItem(Base):
    __tablename__ = "store_items"
    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, default="")
    item_type   = Column(Enum(ItemType), nullable=False)
    cost        = Column(Integer, default=0)
    css_value   = Column(String, nullable=False)
    preview     = Column(String, default="")
    file_url    = Column(String, nullable=True)
    is_animated = Column(Boolean, default=False)

class Purchase(Base):
    __tablename__ = "purchases"
    id      = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("store_items.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner   = relationship("User", back_populates="purchases")

class AppState(Base):
    __tablename__ = "app_state"
    id            = Column(Integer, primary_key=True, index=True)
    coins         = Column(Integer, default=100)
    equipped_json = Column(String, default="{}")
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    owner         = relationship("User", back_populates="app_state")

# models.py — add these imports at the top if not already there
from datetime import datetime

# ── New models ─────────────────────────────────────────────────────────────────

class BuddyInvite(Base):
    __tablename__ = "buddy_invite"

    id         = Column(Integer, primary_key=True)
    code       = Column(String, unique=True, nullable=False)
    sender_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", back_populates="sent_invites")


class BuddyLink(Base):
    __tablename__ = "buddy_link"

    id         = Column(Integer, primary_key=True)
    user_a_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_b_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TaskComment(Base):
    __tablename__ = "task_comment"

    id         = Column(Integer, primary_key=True)
    task_id    = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    author_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    emoji      = Column(String, nullable=True)   # e.g. "👍"
    text       = Column(String, nullable=True)   # short comment, 200 char max
    created_at = Column(DateTime, default=datetime.utcnow)

    task   = relationship("Task",   back_populates="comments")
    author = relationship("User",   back_populates="comments")