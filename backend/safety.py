# backend/safety.py — v4.1 (Bug #1 fixed: timeout enforced; Bug #4 fixed: no false positives)
import sqlite3
import time
import re
import os
import threading
from collections import defaultdict
from fastapi import HTTPException
import pandas as pd

MAX_ROWS = int(os.getenv("MAX_ROWS", 1000))
TIMEOUT_SEC = int(os.getenv("QUERY_TIMEOUT", 5))

# Bug #4 FIX: Dangerous statement TYPES — checked on first token only.
BLOCKED_STATEMENT_TYPES = {
    "drop", "delete", "update", "insert", "create",
    "alter", "truncate", "exec", "execute",
    "commit", "rollback", "begin", "replace",
    "grant", "revoke",
    "pragma", "attach", "detach", "load_extension",
}

# Per-user rate limiter: max 30 executions per minute
_rate_counter: dict = defaultdict(list)


def is_safe(sql: str) -> tuple:
    """
    Returns (safe: bool, reason: str).
    Bug #4 fixed: only checks the FIRST TOKEN of the SQL statement.
    """
    stripped = sql.strip()

    # Rule 1: Must start with SELECT
    if not stripped.lower().startswith("select"):
        first_token = re.split(r'\s+', stripped.lower())[0]
        if first_token in BLOCKED_STATEMENT_TYPES:
            return False, f"Blocked statement type: '{first_token.upper()}'"
        return False, "Only SELECT statements are allowed"

    # Rule 2: Reject SQL comments (injection vectors)
    if "--" in stripped or "/*" in stripped:
        return False, "SQL comments are not allowed"

    # Rule 3: Reject semi-colon stacking (multiple statements)
    if stripped.rstrip(";").count(";") > 0:
        return False, "Multiple SQL statements not allowed"

    return True, "ok"


def check_rate_limit(email: str) -> bool:
    """Allow max 30 executions per minute per user."""
    now = time.time()
    _rate_counter[email] = [t for t in _rate_counter[email] if now - t < 60]
    if len(_rate_counter[email]) >= 30:
        return False
    _rate_counter[email].append(now)
    return True


def execute_on_sqlite(sql: str, df: pd.DataFrame, table: str) -> tuple:
    """
    Execute SQL on in-memory SQLite with a hard timeout.
    Bug #1 fixed: uses threading.Timer to interrupt long-running queries.
    Returns (rows: list[dict], columns: list[str], exec_ms: int)
    """
    # Add LIMIT if not present
    sql_exec = sql.rstrip(";")
    if "limit" not in sql.lower():
        sql_exec += f" LIMIT {MAX_ROWS}"

    start = time.time()
    conn = sqlite3.connect(":memory:")
    df.to_sql(table, conn, index=False, if_exists="replace")

    # Bug #1 FIX: enforce TIMEOUT_SEC using threading.Timer
    timed_out = [False]

    def _timeout_handler():
        timed_out[0] = True
        try:
            conn.interrupt()
        except Exception:
            pass

    timer = threading.Timer(TIMEOUT_SEC, _timeout_handler)
    timer.start()

    try:
        cur = conn.cursor()
        cur.execute(sql_exec)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    except sqlite3.OperationalError as e:
        if timed_out[0] or "interrupted" in str(e).lower():
            raise HTTPException(
                408,
                f"Query timed out after {TIMEOUT_SEC}s. Simplify your query or add a LIMIT."
            )
        raise HTTPException(400, f"SQL error: {str(e)}")
    finally:
        timer.cancel()
        conn.close()

    exec_ms = int((time.time() - start) * 1000)
    return rows, cols, exec_ms
