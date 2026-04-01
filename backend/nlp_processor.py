# backend/nlp_processor.py — Enhanced NLP pre-processing layer
# Handles: typos, singular/plural, synonyms, fuzzy column matching
# Pure Python: regex, difflib, rule-based — runs in <1ms

import re
from difflib import get_close_matches

# ── Intent patterns ──
INTENT_PATTERNS = {
    "count": [r"\bhow many\b", r"\bcount\b", r"\btotal number\b", r"\bnumber of\b"],
    "sum": [r"\btotal\b", r"\bsum\b", r"\baggregate\b"],
    "average": [r"\baverage\b", r"\bavg\b", r"\bmean\b"],
    "max": [r"\bmax\b", r"\bmaximum\b", r"\bhighest\b", r"\blargest\b", r"\btop\b", r"\bbiggest\b"],
    "min": [r"\bmin\b", r"\bminimum\b", r"\blowest\b", r"\bsmallest\b", r"\bbottom\b"],
    "group": [r"\bby department\b", r"\bby category\b", r"\bper\b", r"\bgroup\b", r"\beach\b", r"\bby\b"],
    "filter": [r"\bwhere\b", r"\bfilter\b", r"\bonly\b", r"\bwith\b", r"\bgreater than\b", r"\bless than\b"],
    "sort": [r"\bsort\b", r"\border\b", r"\brank\b", r"\btop \d+\b", r"\bbottom \d+\b"],
    "select": [r"\bshow\b", r"\blist\b", r"\bget\b", r"\bdisplay\b", r"\bfind\b", r"\bfetch\b"],
    "mutation": [
        r"\binsert\b", r"\bdelete\b", r"\bdrop\b", r"\btruncate\b", r"\bupdate\b",
        r"\bcreate table\b", r"\bcreate\b", r"\balter\b", r"\brollback\b", r"\bcommit\b",
        r"\bbegin\b", r"\breplace\b"
    ],
}

# ── Typo corrections ──
CORRECTIONS = {
    "employes": "employees", "emploee": "employee", "emploeyee": "employee",
    "deprtment": "department", "dept": "department",
    "salry": "salary", "sal": "salary",
    "prodct": "product", "custmer": "customer",
    "revnue": "revenue", "totl": "total",
    "avrage": "average", "maximm": "maximum", "minimm": "minimum",
    "recrd": "record", "recrds": "records",
    "categry": "category", "categores": "categories",
}

# ── Synonym map for common words ──
SYNONYMS = {
    "sport": ["sports", "sport", "sporting"],
    "sports": ["sports", "sport", "sporting"],
    "employee": ["employees", "employee", "emp", "staff", "worker"],
    "employees": ["employees", "employee", "emp", "staff", "workers"],
    "category": ["categories", "category", "cat", "type"],
    "categories": ["categories", "category", "cat", "types"],
    "product": ["products", "product", "item", "items"],
    "products": ["products", "product", "items"],
    "record": ["records", "record", "entry", "entries", "row", "rows"],
    "records": ["records", "record", "entries", "rows"],
    "department": ["departments", "department", "dept", "depts"],
    "departments": ["departments", "department", "depts"],
    "sale": ["sales", "sale", "transaction"],
    "sales": ["sales", "sale", "transactions"],
    "order": ["orders", "order"],
    "orders": ["orders", "order"],
    "customer": ["customers", "customer", "client", "clients"],
    "customers": ["customers", "customer", "clients"],
}

MEANINGLESS_INPUT_PATTERNS = [
    r"^\s*$",
    r"^(hi|hello|hey|yo|hola|test|ok|okay|thanks|thank you)\W*$",
]

NON_QUERY_SINGLE_TOKENS = {
    "hi", "hello", "hey", "yo", "hola", "test", "ok", "okay",
    "thanks", "thankyou", "hmm", "huh", "lol", "bro", "sup",
}


def simple_stem(word: str) -> str:
    """Very simple stemmer: strips common English suffixes to get root form."""
    w = word.lower()
    # Order matters — check longer suffixes first
    for suffix in ("ies", "ves", "ses", "ches", "shes", "xes"):
        if w.endswith(suffix) and len(w) > len(suffix) + 2:
            if suffix == "ies":
                return w[:-3] + "y"
            return w[:-len(suffix)] + suffix[-2] if suffix.endswith("es") else w[:-len(suffix)]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        return w[:-1]
    return w


def normalize_word(word: str, column_names: list = None, table_name: str = "") -> str:
    """
    Normalize a word by:
    1. Checking corrections dict
    2. Checking synonyms
    3. Fuzzy matching against column names and table name
    4. Simple stemming + re-match
    """
    lower = word.lower()

    # Direct correction
    if lower in CORRECTIONS:
        return CORRECTIONS[lower]

    if not column_names:
        return word

    # Build target list: column names + table name
    targets = [c.lower() for c in column_names]
    if table_name:
        targets.append(table_name.lower())

    # Direct match
    if lower in targets:
        return word

    # Synonym expansion — check if any synonym matches a target
    if lower in SYNONYMS:
        for syn in SYNONYMS[lower]:
            if syn in targets:
                # Return the matching target in original case
                for c in column_names:
                    if c.lower() == syn:
                        return c
                if table_name.lower() == syn:
                    return table_name
        # Also check stem of synonyms
        for syn in SYNONYMS[lower]:
            for t in targets:
                if simple_stem(syn) == simple_stem(t):
                    for c in column_names:
                        if c.lower() == t:
                            return c
                    if table_name.lower() == t:
                        return table_name

    # Stem matching — compare stem of input word to stems of targets
    input_stem = simple_stem(lower)
    for target in targets:
        if simple_stem(target) == input_stem:
            for c in column_names:
                if c.lower() == target:
                    return c
            if table_name.lower() == target:
                return table_name

    # Fuzzy match (difflib) — lowered cutoff for better recall
    matches = get_close_matches(lower, targets, n=1, cutoff=0.6)
    if matches:
        for c in column_names:
            if c.lower() == matches[0]:
                return c
        if table_name.lower() == matches[0]:
            return table_name

    return word


def detect_intent(question: str) -> str:
    """Detect the SQL intent from a natural language question."""
    q_lower = question.lower()
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, q_lower):
                return intent
    return "select"


def is_meaningless_input(question: str) -> bool:
    """Return True for conversational/noise inputs that are not data questions."""
    text = (question or "").strip().lower()
    for pattern in MEANINGLESS_INPUT_PATTERNS:
        if re.match(pattern, text):
            return True

    if re.match(r"^[a-zA-Z_]+$", text) and text in NON_QUERY_SINGLE_TOKENS:
        return True

    # Nonsense like "asdfgh" or repeated chars should be rejected.
    if re.match(r"^[a-z]{4,}$", text) and len(set(text)) <= 3:
        return True

    return False


def extract_row_scope(question: str) -> tuple:
    """Return (scope_word, n) for phrases like 'top 10', 'first 5', 'last 3'."""
    q = (question or "").lower()
    m = re.search(r"\b(top|first|last)\s+(\d+)\b", q)
    if not m:
        return None, None
    return m.group(1), int(m.group(2))


def _pick_metric_column(question: str, columns: list) -> str:
    """Best-effort metric column selection for SUM/AVG row-scoped queries."""
    q = (question or "").lower()
    lowered_columns = [c.lower() for c in columns]

    # Prefer explicit "sum of <column>" / "average <column>" mention.
    m = re.search(r"\b(?:sum|total|avg|average|mean)\s+(?:of\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\b", q)
    if m:
        token = m.group(1).lower()
        for i, col in enumerate(lowered_columns):
            if token == col:
                return columns[i]

    # Otherwise use first column explicitly mentioned in question.
    for i, col in enumerate(lowered_columns):
        if re.search(rf"\b{re.escape(col)}\b", q):
            return columns[i]

    # Last resort: first column.
    return columns[0] if columns else "*"


def build_row_scoped_agg_sql(question: str, table_name: str, columns: list, intent: str) -> str:
    """Build deterministic SQL for row-scoped SUM/AVG edge cases.

    Example:
    SELECT SUM(salary) AS sum_salary
    FROM (SELECT salary FROM employees ORDER BY salary DESC LIMIT 10)
    """
    if intent not in {"sum", "average"}:
        return ""

    scope, n = extract_row_scope(question)
    if not scope or not n:
        return ""

    metric_col = _pick_metric_column(question, columns)
    agg_fn = "SUM" if intent == "sum" else "AVG"
    alias = f"{intent}_{metric_col}".replace(" ", "_")

    if scope == "top":
        order_clause = f"ORDER BY {metric_col} DESC"
    elif scope == "last":
        order_clause = f"ORDER BY rowid DESC"
    else:  # first
        order_clause = f"ORDER BY rowid ASC"

    return (
        f"SELECT {agg_fn}({metric_col}) AS {alias} "
        f"FROM (SELECT {metric_col} FROM {table_name} {order_clause} LIMIT {n})"
    )


def build_mutation_syntax_template(question: str, table_name: str, columns: list) -> str:
    """Return non-executable mutation SQL syntax templates for destructive intents."""
    q = (question or "").lower()
    sample_cols = ", ".join(columns[:2]) if columns else "column1, column2"
    sample_vals = ", ".join(["value1", "value2"][: max(1, min(2, len(columns)))])

    if "insert" in q:
        return f"INSERT INTO {table_name} ({sample_cols}) VALUES ({sample_vals})"
    if "delete" in q:
        return f"DELETE FROM {table_name} WHERE condition"
    if "drop" in q:
        return f"DROP TABLE {table_name}"
    if "update" in q:
        first_col = columns[0] if columns else "column1"
        return f"UPDATE {table_name} SET {first_col} = value WHERE condition"
    if "alter" in q:
        return f"ALTER TABLE {table_name} ADD COLUMN new_column TEXT"
    if "create table" in q or re.search(r"\bcreate\b", q):
        return "CREATE TABLE table_name (column1 TEXT, column2 INTEGER)"
    if "truncate" in q:
        return f"DELETE FROM {table_name}"
    if "rollback" in q:
        return "ROLLBACK"
    if "commit" in q:
        return "COMMIT"
    if "begin" in q:
        return "BEGIN TRANSACTION"

    return "ALTER TABLE table_name -- mutation syntax"


def preprocess_question(question: str, column_names: list = None, table_name: str = "") -> dict:
    """
    Full NLP pre-processing pipeline:
    1. Clean & normalize
    2. Correct typos + normalize words (stem, synonym, fuzzy)
    3. Detect intent
    Returns dict with processed info for the LLM prompt.
    """
    cleaned = question.strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)

    # Normalize each word
    words = cleaned.split()
    corrected_words = [normalize_word(w, column_names, table_name) for w in words]
    corrected = " ".join(corrected_words)

    intent = detect_intent(corrected)
    meaningless = is_meaningless_input(corrected)

    return {
        "original": question,
        "corrected": corrected,
        "intent": intent,
        "is_meaningless": meaningless,
        "is_mutation_intent": intent == "mutation",
        "had_typos": corrected != cleaned,
    }


def build_llm_prompt(question: str, table_name: str, columns: list, intent: str) -> str:
    """
    Build the prompt sent to Mistral for SQL generation.
    Includes fuzzy matching hints so the LLM uses LIKE for approximate matches.
    """
    col_list = ", ".join(columns)

    prompt = f"""You are a SQL query generator. Given a natural language question and a table schema, generate the appropriate SQLite statement. Do NOT include any explanation, markdown, or backticks.

Table name: {table_name}
Columns: {col_list}
Detected intent: {intent}

Rules:
1. Generate the appropriate SQL statement based on the question (can be SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, COMMIT, ROLLBACK, etc.).
2. Use the exact table name: {table_name}
3. Use the exact column names from the schema above
4. For aggregations (count, sum, avg, max, min), use appropriate SQL functions
5. For grouping queries, include GROUP BY
6. For sorting queries, include ORDER BY
7. Add LIMIT 100 if the query might return many rows
8. If asked to aggregate (SUM, AVG) over a specific limited number of rows (e.g. "sum of top 10", "average of first 5"), you MUST use a subquery (e.g. SELECT SUM(col) FROM (SELECT col FROM table ORDER BY ... LIMIT 10)).
9. For row-scoped SUM/AVG, do NOT aggregate over the full table and then add LIMIT outside. LIMIT must be inside the subquery that picks rows.
10. If the question asks for a table/data-changing command (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, COMMIT, ROLLBACK), generate only command syntax (no explanation).
11. If the user's input is meaningless, not a valid data query, or conversational (like "hello", "hi", "wrong", "test"), output EXACTLY "invalid input".
12. Output ONLY the SQL query (or EXACTLY "invalid input"), nothing else.
13. IMPORTANT: When the user mentions a value that might not match exactly (e.g. "sport" when the data has "sports", or "sci-fi" when data has "Science Fiction"), use LIKE with wildcards for flexible matching. For example: WHERE column LIKE '%sport%' instead of WHERE column = 'sport'
14. For counting/filtering by category names, always prefer LIKE '%keyword%' over exact match = 'keyword' to handle plural/singular and partial matches

Question: {question}

SQL:"""
    return prompt
