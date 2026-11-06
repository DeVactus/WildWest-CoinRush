"""Coin Rush: Wild West - Leaderboard API (Flask + SQLite).

Jalankan:
    cd backend
    python app.py          (http://127.0.0.1:5000)

Endpoint:
    GET  /api/leaderboard?limit=10
    POST /api/leaderboard   {name, score, wave, coins, character}
    GET  /api/health
"""
import os
import sqlite3
import time
from contextlib import closing

from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("COINRUSH_DB", os.path.join(BASE_DIR, "leaderboard.db"))

MAX_SCORE = 5_000_000      # batas kewajaran, tolak skor aneh
MIN_SUBMIT_GAP = 3         # detik antar submit dari IP yang sama

app = Flask(__name__)
CORS(app)
_last_submit = {}


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with closing(db()) as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                score INTEGER NOT NULL,
                wave INTEGER NOT NULL,
                coins INTEGER NOT NULL DEFAULT 0,
                character TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_score ON scores(score DESC)")
        conn.commit()


@app.get("/api/health")
def health():
    return jsonify(ok=True)


@app.get("/api/leaderboard")
def get_leaderboard():
    try:
        limit = max(1, min(100, int(request.args.get("limit", 10))))
    except ValueError:
        limit = 10
    with closing(db()) as conn:
        rows = conn.execute(
            "SELECT name, score, wave, coins, character, created_at FROM scores "
            "ORDER BY score DESC, wave DESC, id ASC LIMIT ?",
            (limit,),
        ).fetchall()
    return jsonify(entries=[dict(r) for r in rows])


@app.post("/api/leaderboard")
def post_score():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()[:16]
    character = str(data.get("character", ""))[:24]
    try:
        score = int(data.get("score", 0))
        wave = int(data.get("wave", 1))
        coins = int(data.get("coins", 0))
    except (TypeError, ValueError):
        return jsonify(error="invalid numbers"), 400

    if len(name) < 3:
        return jsonify(error="name too short"), 400
    if not (0 <= score <= MAX_SCORE) or not (1 <= wave <= 500) or coins < 0:
        return jsonify(error="invalid score"), 400

    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    now = time.time()
    if now - _last_submit.get(ip, 0) < MIN_SUBMIT_GAP:
        return jsonify(error="too fast"), 429
    _last_submit[ip] = now

    with closing(db()) as conn:
        conn.execute(
            "INSERT INTO scores (name, score, wave, coins, character) VALUES (?,?,?,?,?)",
            (name, score, wave, coins, character),
        )
        conn.commit()
        rank = conn.execute(
            "SELECT COUNT(*) + 1 FROM scores WHERE score > ?", (score,)
        ).fetchone()[0]
    return jsonify(ok=True, rank=rank)


init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
