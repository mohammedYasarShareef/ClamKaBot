# backend/db.py — Database module with 5-table schema
# Migrated from SQLite → Supabase (PostgreSQL)

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Must call load_dotenv() HERE so DATABASE_URL is available
# before main.py imports this module.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set.\n"
        "  Local: add DATABASE_URL=postgresql://... to backend/.env\n"
        "  Render: add DATABASE_URL in the dashboard Environment tab."
    )


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def get_cursor(conn):
    """Dict-like cursor — equivalent to sqlite3.Row behaviour."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    conn = get_db()
    c = get_cursor(conn)

    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id        SERIAL PRIMARY KEY,
        name      TEXT NOT NULL DEFAULT '',
        email     TEXT UNIQUE NOT NULL,
        password  TEXT NOT NULL,
        created   TEXT NOT NULL
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS datasets (
        id            SERIAL PRIMARY KEY,
        email         TEXT NOT NULL,
        table_name    TEXT NOT NULL,
        original_name TEXT NOT NULL,
        row_count     INTEGER,
        col_count     INTEGER,
        columns_json  TEXT,
        uploaded_at   TEXT NOT NULL
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS query_history (
        id           SERIAL PRIMARY KEY,
        email        TEXT NOT NULL,
        session_id   TEXT,
        nl_query     TEXT NOT NULL,
        sql_query    TEXT NOT NULL,
        table_name   TEXT NOT NULL,
        row_count    INTEGER,
        intent       TEXT,
        executed     BOOLEAN DEFAULT FALSE,
        created_at   TEXT NOT NULL
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS artifacts (
        id           SERIAL PRIMARY KEY,
        email        TEXT NOT NULL,
        history_id   INTEGER REFERENCES query_history(id),
        filename     TEXT NOT NULL,
        format       TEXT NOT NULL,
        created_at   TEXT NOT NULL
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS execution_log (
        id           SERIAL PRIMARY KEY,
        email        TEXT NOT NULL,
        history_id   INTEGER REFERENCES query_history(id),
        sql_query    TEXT NOT NULL,
        row_count    INTEGER,
        exec_time_ms INTEGER,
        blocked      BOOLEAN DEFAULT FALSE,
        block_reason TEXT,
        executed_at  TEXT NOT NULL
    )
    """)

    conn.commit()
    c.close()
    conn.close()
    print("✅ DB initialised — 5 tables ready")
