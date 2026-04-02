# backend/main.py — ClamkaBot v4.1 FastAPI Server
# Production-ready: Supabase PostgreSQL, dataset cache with disk fallback.

import os
import io
import json
import re
import uuid
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import jwt, JWTError
from passlib.context import CryptContext
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from db import init_db, get_db, get_cursor
from mistral_client import call_mistral
from nlp_processor import (
    preprocess_question,
    build_llm_prompt,
    build_row_scoped_agg_sql,
    build_mutation_syntax_template,
)
from safety import is_safe, check_rate_limit, execute_on_sqlite
from export_utils import generate_pdf, generate_docx

load_dotenv()

# ── App Setup ─────────────────────────────────────────────
app = FastAPI(title="ClamkaBot API", version="4.1")

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth Config ───────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "clamkabot-super-secret-jwt-key-2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 30  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ── Dataset cache ─────────────────────────────────────────
# Primary: in-memory DataFrames  {email: {table_name: DataFrame}}
# Fallback: temp files on disk   {email_table: Path}  — survives --reload
_datasets: dict = {}
_dataset_files: dict = {}        # key = f"{email}::{table_name}"
_last_cleared: dict = {}

ROW_SCOPED_AGG_REGEX = re.compile(r"\b(top|first|last)\s+(\d+)\b", re.IGNORECASE)

# Temp dir that persists across uvicorn --reload worker restarts
_TMPDIR = Path(tempfile.gettempdir()) / "clamkabot_datasets"
_TMPDIR.mkdir(exist_ok=True)


def _cache_key(email: str, table_name: str) -> str:
    return f"{email}::{table_name}"


def _store_dataset(email: str, table_name: str, df: pd.DataFrame, ext: str):
    """Store DataFrame in memory AND as a temp file (parquet for speed)."""
    if email not in _datasets:
        _datasets[email] = {}
    _datasets[email][table_name] = df

    # Persist to disk so --reload workers can reload it
    key = _cache_key(email, table_name)
    tmp_path = _TMPDIR / f"{key.replace('::', '__')}.parquet"
    df.to_parquet(tmp_path, index=False)
    _dataset_files[key] = tmp_path


def _get_dataset(email: str, table_name: str) -> pd.DataFrame | None:
    """Return DataFrame from memory, falling back to disk cache."""
    # 1. Memory hit
    if email in _datasets and table_name in _datasets[email]:
        return _datasets[email][table_name]

    # 2. Disk fallback (survives --reload)
    key = _cache_key(email, table_name)
    tmp_path = _TMPDIR / f"{key.replace('::', '__')}.parquet"
    if tmp_path.exists():
        df = pd.read_parquet(tmp_path)
        if email not in _datasets:
            _datasets[email] = {}
        _datasets[email][table_name] = df
        return df

    return None


# ── Startup ───────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()


# ═══════════════════════════════════════════════════════════
# AUTH HELPERS
# ═══════════════════════════════════════════════════════════
def create_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_email(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(401, "Invalid token")
        return email
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")


# ═══════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════
class AuthRequest(BaseModel):
    email: str
    password: str
    name: str = ""


@app.post("/auth/register")
def register(req: AuthRequest):
    if not req.email or not req.password:
        raise HTTPException(400, "Email and password required")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute("SELECT id FROM users WHERE email=%s", (req.email,))
        if c.fetchone():
            raise HTTPException(409, "Email already registered")

        hashed = pwd_context.hash(req.password)
        c.execute(
            "INSERT INTO users (name, email, password, created) VALUES (%s, %s, %s, %s)",
            (req.name.strip() or req.email.split("@")[0], req.email, hashed, datetime.now().isoformat()),
        )
        conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")
    finally:
        conn.close()

    token = create_token(req.email)
    return {
        "token": token,
        "email": req.email,
        "name": req.name.strip() or req.email.split("@")[0],
        "message": "Registered successfully",
    }


@app.post("/auth/login")
def login(req: AuthRequest):
    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute("SELECT name, email, password FROM users WHERE email=%s", (req.email,))
        user = c.fetchone()
    finally:
        conn.close()

    if not user or not pwd_context.verify(req.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(req.email)
    return {
        "token": token,
        "email": req.email,
        "name": user["name"] or req.email.split("@")[0],
        "message": "Login successful",
    }


@app.post("/auth/refresh")
def refresh_token(email: str = Depends(get_email)):
    """Issue a fresh token for an already-authenticated user."""
    new_token = create_token(email)
    return {"token": new_token}


# ═══════════════════════════════════════════════════════════
# DATASET ENDPOINTS
# ═══════════════════════════════════════════════════════════
@app.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...), email: str = Depends(get_email)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(400, "Only CSV and Excel files are supported")

    try:
        contents = await file.read()
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {str(e)}")

    table_name = re.sub(r"[^a-zA-Z0-9_]", "_", file.filename.rsplit(".", 1)[0]).lower()
    if not table_name or table_name[0].isdigit():
        table_name = "t_" + table_name

    # Store in memory + disk cache
    _store_dataset(email, table_name, df, ext)

    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute(
            "INSERT INTO datasets (email, table_name, original_name, row_count, col_count, columns_json, uploaded_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (email, table_name, file.filename, len(df), len(df.columns),
             json.dumps(list(df.columns)), datetime.now().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "table_name": table_name,
        "columns": list(df.columns),
        "row_count": len(df),
        "col_count": len(df.columns),
        "preview": {
            "table_name": table_name,
            "columns": list(df.columns),
            "rows": df.head(5).fillna("").to_dict("records"),
            "row_count": len(df),
        },
    }


@app.get("/dataset/{name}/preview")
def preview_dataset(name: str, email: str = Depends(get_email)):
    df = _get_dataset(email, name)
    if df is None:
        raise HTTPException(404, "Dataset not found. Please upload your file again.")
    return {
        "table_name": name,
        "columns": list(df.columns),
        "rows": df.head(5).fillna("").to_dict("records"),
        "row_count": len(df),
    }


# ═══════════════════════════════════════════════════════════
# QUERY ENDPOINTS
# ═══════════════════════════════════════════════════════════
def _needs_row_scoped_agg(question: str, intent: str) -> bool:
    if intent not in {"sum", "average"}:
        return False
    return bool(ROW_SCOPED_AGG_REGEX.search(question or ""))


def _has_row_scoped_agg_sql(sql: str) -> bool:
    lowered = (sql or "").lower()
    if "sum(" not in lowered and "avg(" not in lowered:
        return False
    return "from (" in lowered and "limit" in lowered


def _repair_row_scoped_agg(question, sql, table_name, columns, intent):
    if not _needs_row_scoped_agg(question, intent):
        return sql
    if _has_row_scoped_agg_sql(sql):
        return sql
    repaired = build_row_scoped_agg_sql(question, table_name, columns, intent)
    return repaired or sql


class GenerateRequest(BaseModel):
    question: str
    table_name: str


@app.post("/query/generate")
def generate_query(req: GenerateRequest, email: str = Depends(get_email)):
    df = _get_dataset(email, req.table_name)
    if df is None:
        raise HTTPException(404, "Dataset not loaded. Please upload your file first.")

    columns = list(df.columns)
    nlp_result = preprocess_question(req.question, columns, req.table_name)

    if nlp_result.get("is_meaningless"):
        sql = "invalid input"
    elif nlp_result.get("is_mutation_intent"):
        sql = build_mutation_syntax_template(nlp_result["corrected"], req.table_name, columns)
    else:
        prompt = build_llm_prompt(nlp_result["corrected"], req.table_name, columns, nlp_result["intent"])
        sql = call_mistral(prompt)
        sql = _repair_row_scoped_agg(nlp_result["corrected"], sql, req.table_name, columns, nlp_result["intent"])

    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute(
            "INSERT INTO query_history (email, session_id, nl_query, sql_query, table_name, row_count, intent, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (email, str(uuid.uuid4())[:8], req.question, sql, req.table_name,
             None, nlp_result["intent"], datetime.now().isoformat()),
        )
        history_id = c.fetchone()["id"]
        conn.commit()
    finally:
        conn.close()

    return {
        "id": history_id,
        "nl_query": req.question,
        "sql_query": sql,
        "table_name": req.table_name,
        "intent": nlp_result["intent"],
        "nlp": nlp_result,
    }


class RunRequest(BaseModel):
    history_id: int
    table_name: str


@app.post("/query/run")
def run_query(req: RunRequest, email: str = Depends(get_email)):
    if not check_rate_limit(email):
        raise HTTPException(429, "Rate limit: max 30 queries/minute")

    conn = get_db()
    try:
        c = get_cursor(conn)

        c.execute(
            "SELECT sql_query, intent FROM query_history WHERE id=%s AND email=%s",
            (req.history_id, email),
        )
        row = c.fetchone()
        if not row:
            raise HTTPException(404, "Query not found")

        sql = row["sql_query"]
        intent = (row["intent"] or "").strip().lower()

        if (sql or "").strip().lower() == "invalid input":
            c.execute(
                "INSERT INTO execution_log (email, history_id, sql_query, blocked, block_reason, executed_at) VALUES (%s,%s,%s,TRUE,%s,%s)",
                (email, req.history_id, sql, "Invalid input — not executable", datetime.now().isoformat()),
            )
            conn.commit()
            raise HTTPException(400, "Blocked: invalid input")

        if intent == "mutation":
            c.execute(
                "INSERT INTO execution_log (email, history_id, sql_query, blocked, block_reason, executed_at) VALUES (%s,%s,%s,TRUE,%s,%s)",
                (email, req.history_id, sql, "Mutation syntax is non-executable by design", datetime.now().isoformat()),
            )
            conn.commit()
            raise HTTPException(400, "Blocked: mutation syntax is not executable")

        safe, reason = is_safe(sql)
        if not safe:
            c.execute(
                "INSERT INTO execution_log (email, history_id, sql_query, blocked, block_reason, executed_at) VALUES (%s,%s,%s,TRUE,%s,%s)",
                (email, req.history_id, sql, reason, datetime.now().isoformat()),
            )
            conn.commit()
            raise HTTPException(400, f"Blocked: {reason}")

        # Load dataset — tries memory first, then disk cache
        df = _get_dataset(email, req.table_name)
        if df is None:
            raise HTTPException(
                404,
                "Dataset not in memory. Please re-upload your file — "
                "datasets reset when the server restarts.",
            )

        results, cols, exec_ms = execute_on_sqlite(sql, df, req.table_name)

        c.execute(
            "UPDATE query_history SET executed=TRUE, row_count=%s WHERE id=%s",
            (len(results), req.history_id),
        )
        c.execute(
            "INSERT INTO execution_log (email, history_id, sql_query, row_count, exec_time_ms, blocked, executed_at) VALUES (%s,%s,%s,%s,%s,FALSE,%s)",
            (email, req.history_id, sql, len(results), exec_ms, datetime.now().isoformat()),
        )
        conn.commit()

    finally:
        conn.close()

    return {"columns": cols, "results": results, "row_count": len(results), "exec_ms": exec_ms}


# ═══════════════════════════════════════════════════════════
# TF-IDF SUGGEST
# ═══════════════════════════════════════════════════════════
@app.get("/query/suggest")
def suggest_query(q: str, table_name: str, email: str = Depends(get_email)):
    if not q or len(q) < 2:
        return {"suggestions": []}

    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute(
            "SELECT id, nl_query, sql_query FROM query_history WHERE email=%s AND table_name=%s ORDER BY created_at DESC LIMIT 200",
            (email, table_name),
        )
        rows = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()

    if not rows:
        return {"suggestions": []}

    corpus = [r["nl_query"] for r in rows]
    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=500)
        tfidf_matrix = vectorizer.fit_transform(corpus)
        query_vec = vectorizer.transform([q])
        sims = cosine_similarity(query_vec, tfidf_matrix).flatten()
        top_indices = sims.argsort()[-5:][::-1]
        suggestions = [
            {"id": rows[i]["id"], "nl_query": rows[i]["nl_query"],
             "sql_query": rows[i]["sql_query"], "score": round(float(sims[i]), 3)}
            for i in top_indices if sims[i] > 0.05
        ]
    except Exception:
        suggestions = []

    return {"suggestions": suggestions}


# ═══════════════════════════════════════════════════════════
# HISTORY + SEARCH
# ═══════════════════════════════════════════════════════════
@app.get("/history")
def get_history(page: int = 1, email: str = Depends(get_email)):
    limit = 50
    offset = (page - 1) * limit
    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute(
            "SELECT id, nl_query, sql_query, table_name, intent, row_count, executed, created_at FROM query_history WHERE email=%s ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (email, limit, offset),
        )
        queries = [dict(r) for r in c.fetchall()]
        c.execute("SELECT COUNT(*) as total FROM query_history WHERE email=%s", (email,))
        total = c.fetchone()["total"]
    finally:
        conn.close()
    return {"queries": queries, "total": total, "page": page}


@app.get("/history/search")
def search_history(q: str, email: str = Depends(get_email)):
    if not q or len(q) < 2:
        return {"results": []}
    conn = get_db()
    try:
        c = get_cursor(conn)
        pattern = f"%{q.lower()}%"
        c.execute(
            """SELECT id, nl_query, sql_query, table_name, intent, created_at, row_count
               FROM query_history
               WHERE email=%s AND (LOWER(nl_query) LIKE %s OR LOWER(sql_query) LIKE %s)
               ORDER BY created_at DESC LIMIT 50""",
            (email, pattern, pattern),
        )
        rows = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()
    return {"results": rows, "count": len(rows)}


# ═══════════════════════════════════════════════════════════
# EXPORT (PDF / DOCX)
# ═══════════════════════════════════════════════════════════
@app.get("/history/{history_id}/export/pdf")
def export_pdf(history_id: int, email: str = Depends(get_email)):
    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute("SELECT * FROM query_history WHERE id=%s AND email=%s", (history_id, email))
        h = c.fetchone()
        if not h:
            raise HTTPException(404, "Not found")
        h = dict(h)

        rows, cols = [], []
        df = _get_dataset(email, h["table_name"])
        if df is not None:
            try:
                rows, cols, _ = execute_on_sqlite(h["sql_query"], df, h["table_name"])
            except Exception:
                pass

        pdf_bytes = generate_pdf(h["nl_query"], h["sql_query"], h["table_name"], h["intent"] or "select", rows, cols)
        fname = f"query_{history_id}.pdf"
        c.execute(
            "INSERT INTO artifacts (email, history_id, filename, format, created_at) VALUES (%s,%s,%s,%s,%s)",
            (email, history_id, fname, "pdf", datetime.now().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@app.get("/history/{history_id}/export/docx")
def export_docx(history_id: int, email: str = Depends(get_email)):
    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute("SELECT * FROM query_history WHERE id=%s AND email=%s", (history_id, email))
        h = c.fetchone()
        if not h:
            raise HTTPException(404, "Not found")
        h = dict(h)

        rows, cols = [], []
        df = _get_dataset(email, h["table_name"])
        if df is not None:
            try:
                rows, cols, _ = execute_on_sqlite(h["sql_query"], df, h["table_name"])
            except Exception:
                pass

        docx_bytes = generate_docx(h["nl_query"], h["sql_query"], h["table_name"], h["intent"] or "select", rows, cols)
        fname = f"query_{history_id}.docx"
        c.execute(
            "INSERT INTO artifacts (email, history_id, filename, format, created_at) VALUES (%s,%s,%s,%s,%s)",
            (email, history_id, fname, "docx", datetime.now().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    return Response(content=docx_bytes,
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ═══════════════════════════════════════════════════════════
# ARTIFACTS
# ═══════════════════════════════════════════════════════════
@app.get("/artifacts")
def list_artifacts(email: str = Depends(get_email)):
    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute("SELECT * FROM artifacts WHERE email=%s ORDER BY created_at DESC", (email,))
        artifacts = [dict(r) for r in c.fetchall()]
    finally:
        conn.close()
    return {"artifacts": artifacts}


# ═══════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════
@app.get("/notifications/count")
def notification_count(email: str = Depends(get_email)):
    since = _last_cleared.get(email, "1970-01-01")
    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute("SELECT COUNT(*) as n FROM query_history WHERE email=%s AND created_at > %s", (email, since))
        count = c.fetchone()["n"]
    finally:
        conn.close()
    return {"count": count}


@app.post("/notifications/clear")
def clear_notifications(email: str = Depends(get_email)):
    _last_cleared[email] = datetime.now().isoformat()
    return {"cleared": True}


# ═══════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════
@app.get("/")
def health():
    return {"status": "ok", "version": "4.1", "name": "ClamkaBot"}


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "4.1"}


# ═══════════════════════════════════════════════════════════
# DB EXPLORER — PostgreSQL (information_schema)
# ═══════════════════════════════════════════════════════════
@app.get("/db/tables")
def db_tables(email: str = Depends(get_email)):
    allowed = {"users", "datasets", "query_history", "artifacts", "execution_log"}
    conn = get_db()
    try:
        c = get_cursor(conn)
        tables = []
        for name in sorted(allowed):
            c.execute(f'SELECT COUNT(*) as cnt FROM "{name}"')
            count = c.fetchone()["cnt"]
            c.execute(
                "SELECT column_name as name, data_type as type FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
                (name,),
            )
            columns = [{"name": col["name"], "type": col["type"]} for col in c.fetchall()]
            tables.append({"name": name, "row_count": count, "columns": columns})
    finally:
        conn.close()
    return {"tables": tables, "db_path": "Supabase (PostgreSQL)"}


@app.get("/db/table/{table_name}")
def db_table_data(table_name: str, page: int = 1, limit: int = 50, email: str = Depends(get_email)):
    allowed = {"users", "datasets", "query_history", "artifacts", "execution_log"}
    if table_name not in allowed:
        raise HTTPException(400, f"Table '{table_name}' not accessible.")

    offset = (page - 1) * limit
    conn = get_db()
    try:
        c = get_cursor(conn)
        c.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
            (table_name,),
        )
        columns = [col["column_name"] for col in c.fetchall()]

        if table_name == "users":
            c.execute(f'SELECT id, email, created FROM "{table_name}" ORDER BY id DESC LIMIT %s OFFSET %s', (limit, offset))
            columns = ["id", "email", "created"]
        else:
            c.execute(f'SELECT * FROM "{table_name}" ORDER BY id DESC LIMIT %s OFFSET %s', (limit, offset))

        rows = [dict(r) for r in c.fetchall()]
        c.execute(f'SELECT COUNT(*) as cnt FROM "{table_name}"')
        total = c.fetchone()["cnt"]
    finally:
        conn.close()

    return {"table": table_name, "columns": columns, "rows": rows, "total": total, "page": page, "limit": limit}


@app.get("/db/schema")
def db_schema(email: str = Depends(get_email)):
    allowed = {"users", "datasets", "query_history", "artifacts", "execution_log"}
    conn = get_db()
    try:
        c = get_cursor(conn)
        schemas = []
        for table_name in sorted(allowed):
            c.execute(
                "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
                (table_name,),
            )
            cols = c.fetchall()
            if cols:
                schemas.append({"table": table_name, "columns": [dict(col) for col in cols]})
    finally:
        conn.close()
    return {"schemas": schemas}
