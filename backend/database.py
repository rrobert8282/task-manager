import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# In production (Render), set DATABASE_URL to your Neon Postgres connection
# string via the dashboard's environment variables. Locally, if DATABASE_URL
# isn't set, this falls back to the SQLite file exactly as before.
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./tasks.db")

# Neon (and some other providers) hand out URLs starting with "postgres://",
# but SQLAlchemy's modern driver expects "postgresql://". Normalize it.
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgres://", "postgresql://", 1
    )

# SQLite needs this connect_arg to allow use across FastAPI's threadpool;
# Postgres does not use or accept this argument.
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()