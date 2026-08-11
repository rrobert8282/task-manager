"""
Backdates a task's last_completed field, for testing the auto-reset logic
without waiting real days. Prints matching tasks if no task_id is given.

Usage:
    python backdate_task.py                      # list your tasks
    python backdate_task.py <task_id> <days_ago>  # backdate last_completed

Run from the backend/ directory. Uses whatever DATABASE_URL is currently set
(or local SQLite if unset), same as the running app.
"""
import sys
from datetime import date, timedelta
from database import SessionLocal
import models

def main():
    db = SessionLocal()
    try:
        if len(sys.argv) < 3:
            tasks = db.query(models.Task).filter(models.Task.repeats == True).all()
            if not tasks:
                print("No repeating tasks found.")
                return
            print("Repeating tasks:")
            for t in tasks:
                print(f"  id={t.id}  type={t.task_type}  done={t.done}  "
                      f"last_completed={t.last_completed}  title={t.title!r}")
            print("\nUsage: python backdate_task.py <task_id> <days_ago>")
            return

        task_id = int(sys.argv[1])
        days_ago = int(sys.argv[2])

        task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if not task:
            print(f"No task with id={task_id}")
            return

        task.last_completed = date.today() - timedelta(days=days_ago)
        db.commit()
        print(f"Set task {task_id} ({task.title!r}) last_completed to {task.last_completed} "
              f"({days_ago} days ago). done is currently {task.done}.")
    finally:
        db.close()

if __name__ == "__main__":
    main()