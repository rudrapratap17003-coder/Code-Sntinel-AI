"""SQLite Persistence for CodeSentinel AI Analysis Results."""

import sqlite3
import json
from typing import List, Optional, Tuple
from pathlib import Path

from app.config import DATABASE_PATH
from app.models.schemas import AnalysisResult, AnalysisListItem


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Initializes the SQLite database tables without altering or dropping existing records."""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analyses (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    display_timestamp TEXT NOT NULL,
                    repository_name TEXT NOT NULL,
                    repository_url TEXT NOT NULL,
                    cmdi REAL NOT NULL,
                    risk_category TEXT NOT NULL,
                    findings_count INTEGER NOT NULL,
                    files_examined INTEGER NOT NULL,
                    full_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_analyses_timestamp ON analyses (timestamp DESC)
                """
            )
    finally:
        conn.close()


def check_db_health() -> Tuple[bool, str, int]:
    """Probes SQLite database connectivity and returns (is_healthy, status_message, record_count)."""
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1;")
            cursor.fetchone()
            cursor.execute("SELECT COUNT(*) FROM analyses;")
            count = cursor.fetchone()[0]
            return True, "connected", count
        finally:
            conn.close()
    except Exception as e:
        return False, f"database_error: {type(e).__name__}", 0


def save_analysis(result: AnalysisResult) -> None:
    """Persists an analysis result into SQLite."""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO analyses (
                    id, timestamp, display_timestamp, repository_name, repository_url,
                    cmdi, risk_category, findings_count, files_examined, full_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    result.id,
                    result.timestamp,
                    result.display_timestamp,
                    result.repository.name,
                    result.repository.url,
                    result.summary.cmdi,
                    result.summary.risk_category,
                    len(result.findings),
                    result.repository.files_examined,
                    result.model_dump_json(),
                ),
            )
    finally:
        conn.close()


def get_analysis(analysis_id: str) -> Optional[AnalysisResult]:
    """Retrieves a full analysis result by its ID."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT full_json FROM analyses WHERE id = ?", (analysis_id,))
        row = cursor.fetchone()
        if not row:
            return None
        data = json.loads(row["full_json"])
        return AnalysisResult(**data)
    finally:
        conn.close()


def list_analyses(limit: int = 50) -> List[AnalysisListItem]:
    """Lists previous analysis run summaries."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, timestamp, display_timestamp, repository_name, repository_url,
                   cmdi, risk_category, findings_count, files_examined
            FROM analyses
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        return [
            AnalysisListItem(
                id=r["id"],
                timestamp=r["timestamp"],
                display_timestamp=r["display_timestamp"],
                repository_name=r["repository_name"],
                repository_url=r["repository_url"],
                cmdi=r["cmdi"],
                risk_category=r["risk_category"],
                findings_count=r["findings_count"],
                files_examined=r["files_examined"],
            )
            for r in rows
        ]
    finally:
        conn.close()


def delete_analysis(analysis_id: str) -> bool:
    """Deletes an analysis record by ID."""
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
            return cursor.rowcount > 0
    finally:
        conn.close()
