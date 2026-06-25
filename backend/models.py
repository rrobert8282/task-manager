from sqlalchemy import Column, Integer, String, Boolean, Date, Enum, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import enum

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