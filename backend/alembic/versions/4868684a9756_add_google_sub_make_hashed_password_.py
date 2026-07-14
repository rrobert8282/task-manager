"""add google_sub, make hashed_password nullable

Revision ID: 4868684a9756
Revises: da601a9c4a89
Create Date: 2026-07-13 05:23:39.765735

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4868684a9756'
down_revision: Union[str, Sequence[str], None] = 'da601a9c4a89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('google_sub', sa.String(), nullable=True))
        batch_op.alter_column('hashed_password',
                   existing_type=sa.VARCHAR(),
                   nullable=True)
        batch_op.create_index(batch_op.f('ix_users_google_sub'), ['google_sub'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_google_sub'))
        batch_op.alter_column('hashed_password',
                   existing_type=sa.VARCHAR(),
                   nullable=False)
        batch_op.drop_column('google_sub')
