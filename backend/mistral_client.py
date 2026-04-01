# backend/mistral_client.py — v4.3 (GitHub Models: Mistral Small 3.1)
# Uses OpenAI-compatible chat completions API via GitHub Models (FREE)
import os
import requests
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

# GitHub Personal Access Token (PAT) — get from https://github.com/settings/tokens
# No special permissions needed. Token starts with github_pat_ or ghp_
_api_key = os.getenv("GITHUB_TOKEN", "")
_model = os.getenv("LLM_MODEL", "mistral-small-2503")
_endpoint = os.getenv("LLM_ENDPOINT", "https://models.inference.ai.azure.com")

if not _api_key:
    print("⚠️  GITHUB_TOKEN is not set — LLM calls will fail. Set it in backend/.env")
else:
    print(f"✅ GitHub Models ready — model: {_model}")


def post_process_sql(text: str) -> str:
    """Strip markdown fences the model sometimes wraps around SQL."""
    text = text.strip()
    for fence in ("```sql", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def call_mistral(prompt: str) -> str:
    """
    Call GitHub Models (Mistral Small 3.1) via OpenAI-compatible API.
    """
    if not _api_key:
        raise HTTPException(
            500,
            "GITHUB_TOKEN is not configured. "
            "Get a free token from https://github.com/settings/tokens and set it in backend/.env"
        )

    url = f"{_endpoint}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_api_key}",
    }
    payload = {
        "model": _model,
        "messages": [
            {
                "role": "system",
                "content": "You are a SQL query generator. Given a natural language question and table schema, output ONLY a valid SQLite SQL query, or EXACTLY 'invalid input' when the question is meaningless. No explanation, no markdown, no backticks."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 300,
        "temperature": 0.1,
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.exceptions.Timeout:
        raise HTTPException(504, "LLM request timed out. Try again.")
    except requests.exceptions.ConnectionError:
        raise HTTPException(502, "Cannot reach GitHub Models API. Check your internet connection.")

    if resp.status_code == 401:
        raise HTTPException(
            401,
            "GitHub token is invalid or expired. "
            "Get a new one from https://github.com/settings/tokens"
        )
    if resp.status_code == 403:
        raise HTTPException(403, "Access denied. Your GitHub token may not have the right permissions.")
    if resp.status_code == 404:
        raise HTTPException(
            404,
            f"Model '{_model}' not found on GitHub Models. "
            "Check the model name at https://github.com/marketplace/models"
        )
    if resp.status_code == 429:
        raise HTTPException(429, "Rate limit hit. Wait a moment and try again.")
    if resp.status_code != 200:
        raise HTTPException(502, f"LLM API error (HTTP {resp.status_code}): {resp.text[:300]}")

    data = resp.json()

    # Extract text from OpenAI-compatible response
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise HTTPException(502, f"Unexpected response format: {str(data)[:200]}")

    if not text or not text.strip():
        raise HTTPException(502, "Model returned an empty response. Try rephrasing your question.")

    return post_process_sql(text)
