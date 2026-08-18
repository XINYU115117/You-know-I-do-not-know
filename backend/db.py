"""数据访问层：SQLite（单文件、零依赖）。

- 数据文件默认 `backend/../data/llmlab.db`；可用 `DATABASE_URL` 覆盖（普通路径或 `sqlite:///路径`）。
- 首次连接自动建表（幂等）。
- 对外接口与之前一致（app.py 无需改动）：
  create_session / upsert_session / insert_event / insert_quiz_answer / memory_snapshot
"""
import json
import os
import sqlite3
from typing import Any, Dict, List, Optional

_DEFAULT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "llmlab.db")
_db_path = os.getenv("DATABASE_URL", "").strip() or _DEFAULT_DB
if _db_path.startswith("sqlite:///"):
    _db_path = _db_path[len("sqlite:///"):]

# upsert_session 允许更新的字段白名单（防 SQL 注入）
_ALLOWED_SESSION_FIELDS = {
    "generation_completed", "total_steps", "duration_ms",
    "review_viewed", "quiz_started", "quiz_completed", "quiz_score",
}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id                   TEXT PRIMARY KEY,
  anonymous_user_id    TEXT NOT NULL,
  conversation_id      TEXT,
  question             TEXT,
  generation_completed INTEGER DEFAULT 0,
  total_steps          INTEGER,
  duration_ms          INTEGER,
  review_viewed        INTEGER DEFAULT 0,
  quiz_started         INTEGER DEFAULT 0,
  quiz_completed       INTEGER DEFAULT 0,
  quiz_score           INTEGER,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_anon ON sessions(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT REFERENCES sessions(id),
  question_id     TEXT NOT NULL,
  quiz_version    TEXT NOT NULL,
  option_order    TEXT,
  selected_answer INTEGER,
  correct_answer  INTEGER,
  is_correct      INTEGER,
  answered_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qa_session ON quiz_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_qid ON quiz_answers(question_id);

CREATE TABLE IF NOT EXISTS events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  anonymous_user_id TEXT,
  session_id        TEXT,
  event             TEXT NOT NULL,
  payload           TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
"""


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_db_path), exist_ok=True)
    conn = sqlite3.connect(_db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)  # 幂等；多语句必须用 executescript
    return conn


def create_session(session_id: str, anonymous_user_id: str, conversation_id: str, question: str):
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (id, anonymous_user_id, conversation_id, question) "
            "VALUES (?, ?, ?, ?)",
            (session_id, anonymous_user_id, conversation_id, question),
        )


def upsert_session(session_id: str, **fields: Any):
    bad = set(fields) - _ALLOWED_SESSION_FIELDS
    if bad:
        raise ValueError(f"不允许更新的字段: {bad}")
    cols = ", ".join(f"{k}=?" for k in fields)
    with _connect() as conn:
        cur = conn.execute(
            f"UPDATE sessions SET {cols}, updated_at=datetime('now') WHERE id=?",
            (*fields.values(), session_id),
        )
        if cur.rowcount == 0:
            # 理论不会发生（app.py 总是先 create_session）；兜底用 INSERT OR IGNORE
            conn.execute(
                f"INSERT OR IGNORE INTO sessions (id, anonymous_user_id, {', '.join(fields)}) "
                f"VALUES (?, '', {', '.join('?' for _ in fields)})",
                (session_id, *fields.values()),
            )


def insert_event(anonymous_user_id: str, session_id: Optional[str], event: str, payload: Optional[dict] = None):
    with _connect() as conn:
        conn.execute(
            "INSERT INTO events (anonymous_user_id, session_id, event, payload) "
            "VALUES (?, ?, ?, ?)",
            (anonymous_user_id, session_id, event,
             json.dumps(payload) if payload else None),
        )


def insert_quiz_answer(session_id: str, question_id: str, quiz_version: str,
                       option_order: list, selected_answer: int,
                       correct_answer: int, is_correct: bool):
    with _connect() as conn:
        conn.execute(
            "INSERT INTO quiz_answers "
            "(session_id, question_id, quiz_version, option_order, "
            " selected_answer, correct_answer, is_correct) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, question_id, quiz_version, json.dumps(option_order),
             selected_answer, correct_answer, int(is_correct)),
        )


def memory_snapshot() -> dict:
    """返回当前库里的数据（兼容旧接口，供 /api/_debug/memory 与分析脚本使用）。"""
    with _connect() as conn:
        sessions = {
            r["id"]: dict(r)
            for r in conn.execute("SELECT * FROM sessions").fetchall()
        }
        events = [dict(r) for r in conn.execute("SELECT * FROM events ORDER BY id").fetchall()]
        quiz = [dict(r) for r in conn.execute("SELECT * FROM quiz_answers ORDER BY id").fetchall()]
    return {
        "backend": "sqlite",
        "db_path": _db_path,
        "sessions": sessions,
        "events": events,
        "quiz_answers": quiz,
    }
