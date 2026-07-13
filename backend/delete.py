"""
Deletes a user and every row across other tables that references them
(tasks, purchases, app state, buddy links/invites, and task comments),
in foreign-key-safe order inside a single transaction.

Usage:
    python delete.py <username>

Run from the backend/ directory, with DATABASE_URL set to the target
database connection string.
"""

import sys

from database import SessionLocal
import models


def delete_user(db, user):
    print(f"Deleting user: {user.username} (id={user.id})")

    # Task IDs owned by this user — needed to clean up comments on their tasks.
    task_ids = [
        task_id
        for (task_id,) in db.query(models.Task.id)
        .filter(models.Task.user_id == user.id)
        .all()
    ]

    # 1. Comments authored by this user, or left on this user's tasks.
    comment_filters = [models.TaskComment.author_id == user.id]
    if task_ids:
        comment_filters.append(models.TaskComment.task_id.in_(task_ids))

    comment_q = db.query(models.TaskComment).filter(
        comment_filters[0] if len(comment_filters) == 1
        else comment_filters[0] | comment_filters[1]
    )
    count = comment_q.count()
    comment_q.delete(synchronize_session=False)
    print(f"  Deleted {count} task comment(s)")

    # 2. Buddy links involving this user.
    link_q = db.query(models.BuddyLink).filter(
        (models.BuddyLink.user_a_id == user.id)
        | (models.BuddyLink.user_b_id == user.id)
    )
    count = link_q.count()
    link_q.delete(synchronize_session=False)
    print(f"  Deleted {count} buddy link(s)")

    # 3. Buddy invites sent by this user.
    invite_q = db.query(models.BuddyInvite).filter(
        models.BuddyInvite.sender_id == user.id
    )
    count = invite_q.count()
    invite_q.delete(synchronize_session=False)
    print(f"  Deleted {count} buddy invite(s)")

    # 4. Purchases.
    purchase_q = db.query(models.Purchase).filter(
        models.Purchase.user_id == user.id
    )
    count = purchase_q.count()
    purchase_q.delete(synchronize_session=False)
    print(f"  Deleted {count} purchase(s)")

    # 5. App state.
    state_q = db.query(models.AppState).filter(
        models.AppState.user_id == user.id
    )
    count = state_q.count()
    state_q.delete(synchronize_session=False)
    print(f"  Deleted {count} app state row(s)")

    # 6. Tasks.
    task_q = db.query(models.Task).filter(models.Task.user_id == user.id)
    count = task_q.count()
    task_q.delete(synchronize_session=False)
    print(f"  Deleted {count} task(s)")

    # 7. The user itself.
    db.delete(user)
    print("  Deleted user row")


def main():
    if len(sys.argv) != 2:
        print("Usage: python delete.py <username>")
        sys.exit(1)

    username = sys.argv[1]

    confirmation = input(
        f"Delete user '{username}' and all associated data? "
        "Type the username again to confirm: "
    )

    if confirmation != username:
        print("Confirmation did not match. No changes made.")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = (
            db.query(models.User)
            .filter(models.User.username == username)
            .first()
        )

        if not user:
            print(f"No user found with username: {username}")
            sys.exit(1)

        delete_user(db, user)
        db.commit()
        print("Done. Changes committed.")
    except Exception as exc:
        db.rollback()
        print(f"ERROR — rolled back, no changes made: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()