"""add client_id for offline task sync

Revision ID: 7d3f9e1b2c44
Revises: 4868684a9756
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d3f9e1b2c44"
down_revision: Union[str, Sequence[str], None] = "4868684a9756"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(
            sa.Column(
                "client_id",
                sa.String(length=64),
                nullable=True,
            )
        )

        batch_op.create_unique_constraint(
            "uq_tasks_user_client_id",
            ["user_id", "client_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_constraint(
            "uq_tasks_user_client_id",
            type_="unique",
        )

        batch_op.drop_column("client_id")