"""Simple SQLite-backed stats tracker.

Records every question and whether it ended in a handoff.
Provides aggregate counts for the GET /stats endpoint.
"""
import sqlite3
from pathlib import Path
from app.config import settings


def _db_path() -> Path:
    path = settings.stats_db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_db_path()))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS questions (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            ts      TEXT    DEFAULT (datetime('now')),
            handoff INTEGER NOT NULL  -- 1 = handoff, 0 = answered
        )
        """
    )
    conn.commit()
    return conn


def record(handoff: bool) -> None:
    """Write one row for each question answered."""
    with _connect() as conn:
        conn.execute("INSERT INTO questions (handoff) VALUES (?)", (1 if handoff else 0,))


def get_stats() -> dict:
    """Return aggregate question and handoff counts."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*), SUM(handoff) FROM questions"
        ).fetchone()
    total = row[0] or 0
    handoffs = int(row[1] or 0)
    return {"total_questions": total, "total_handoffs": handoffs}
