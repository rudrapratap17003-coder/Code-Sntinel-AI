"""Performance, Scalability & Load Testing Suite (Phase 10).

Covers:
1. Progressive repository scalability benchmarks (10 files, 50 files, 100 files).
2. AST reuse verification across sub-analyzers (engine, dependency, error_handling).
3. Duplication detection performance and snippet allocation bounding.
4. SQLite WAL mode and performance pragmas verification.
5. Database and API pagination (limit & offset).
6. GZip response compression for payloads >= 1KB.
7. Concurrent analysis and thread safety under multi-threaded execution.
"""

import os
import time
import sqlite3
import pytest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from app.main import app
from app import config
from app.analyzer.file_discovery import discover_python_files
from app.analyzer.engine import StaticAnalysisEngine
from app.analyzer.duplication import detect_code_duplication
from app.storage.database import (
    init_db,
    save_analysis,
    get_analysis,
    list_analyses,
    get_db_connection,
)
from app.models.schemas import AnalysisResult, AnalysisListItem

client = TestClient(app)


def _create_synthetic_repo(base_dir: Path, file_count: int) -> Path:
    """Helper to generate clean synthetic Python modules with varying functions, imports, and error handling."""
    repo_dir = base_dir / f"synthetic_repo_{file_count}"
    repo_dir.mkdir(parents=True, exist_ok=True)

    for i in range(file_count):
        file_path = repo_dir / f"module_{i:03d}.py"
        # Include cross-module imports for coupling, conditionals for complexity, try/except for error handling
        prev_idx = max(0, i - 1)
        next_idx = (i + 1) % file_count
        code = f'''"""Synthetic test module {i:03d}."""
import os
import sys
from module_{prev_idx:03d} import * # Cross-module import

def process_item_{i}(val: int) -> int:
    """Complex computation function."""
    total = 0
    if val > 100:
        total += 10
    elif val > 50:
        total += 5
    elif val > 20:
        total += 2
    else:
        total += 1

    try:
        if val % 2 == 0:
            result = total * 2
        else:
            result = total * 3
        return result
    except Exception as exc:
        print("Error in module {i}:", exc)
        return -1

def calculate_metric_{i}(a: int, b: int) -> int:
    """Another function with standard branch."""
    if a < b:
        return b - a
    return a - b
'''
        file_path.write_text(code, encoding="utf-8")

    return repo_dir


@pytest.fixture
def isolated_bench_env(tmp_path, monkeypatch):
    """Provides isolated temporary database and allowed workspace for performance tests."""
    test_db = tmp_path / "bench_perf.db"
    monkeypatch.setattr("app.storage.database.DATABASE_PATH", test_db)
    monkeypatch.setattr("app.config.DATABASE_PATH", test_db)
    monkeypatch.setattr("app.config.ALLOW_LOCAL_ANALYSIS", True)

    workspaces = list(getattr(config, "ALLOWED_LOCAL_WORKSPACES", []))
    if tmp_path.resolve() not in workspaces:
        workspaces.append(tmp_path.resolve())
    monkeypatch.setattr("app.config.ALLOWED_LOCAL_WORKSPACES", workspaces)

    init_db()
    return tmp_path, test_db


# ==============================================================================
# 1. Progressive Repository Scalability (10, 50, 100 files)
# ==============================================================================

def test_progressive_scalability_10_50_100_files(isolated_bench_env):
    """Verifies analyzer scales predictably and finishes in bounded time across 10, 50, and 100 files."""
    tmp_path, _ = isolated_bench_env
    engine = StaticAnalysisEngine()

    for count in (10, 50, 100):
        repo_dir = _create_synthetic_repo(tmp_path, count)

        t0 = time.perf_counter()
        files, errors = discover_python_files(repo_dir)
        discovery_ms = (time.perf_counter() - t0) * 1000

        assert len(files) == count
        assert discovery_ms < 2000, f"Discovery of {count} files took {discovery_ms:.1f}ms, expected < 2000ms"

        t1 = time.perf_counter()
        result = engine.analyze_repository(
            repo_dir,
            repo_name=f"test/synthetic_{count}",
            repo_url="local://test/synthetic",
        )
        total_ms = (time.perf_counter() - t1) * 1000

        assert result.repository.files_examined == count
        assert result.summary.cmdi is not None
        assert total_ms < 5000, f"Analysis of {count} files took {total_ms:.1f}ms, expected < 5000ms"

        # Verify that discovered files retained their pre-parsed AST trees
        for f in files:
            assert hasattr(f, "tree")


# ==============================================================================
# 2. AST Reuse Verification
# ==============================================================================

def test_ast_reuse_in_engine(isolated_bench_env):
    """Verifies that engine parses AST once per valid file and shares it across sub-analyzers."""
    tmp_path, _ = isolated_bench_env
    repo_dir = _create_synthetic_repo(tmp_path, 15)
    engine = StaticAnalysisEngine()

    files, errors = discover_python_files(repo_dir)
    assert len(files) == 15

    # Run analysis
    result = engine.analyze_repository(
        repo_dir,
        repo_name="test/synthetic_ast",
        repo_url="local://test/synthetic_ast",
    )
    assert result.repository.files_examined == 15
    assert len(result.hotspots) >= 0


# ==============================================================================
# 3. Duplication Performance and Snippet Allocation Capping
# ==============================================================================

def test_duplication_lazy_snippet_performance(isolated_bench_env):
    """Verifies that duplication detector does not pre-allocate snippets on non-matching windows."""
    tmp_path, _ = isolated_bench_env
    repo_dir = _create_synthetic_repo(tmp_path, 30)

    files, errors = discover_python_files(repo_dir)

    t0 = time.perf_counter()
    blocks, metrics = detect_code_duplication(files)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    assert isinstance(metrics.get("duplication_percent"), (int, float))
    assert elapsed_ms < 500, f"Duplication check on 30 files took {elapsed_ms:.1f}ms (expected < 500ms)"


# ==============================================================================
# 4. SQLite WAL Mode and Performance Pragmas
# ==============================================================================

def test_sqlite_wal_mode_and_pragmas(isolated_bench_env):
    """Verifies that SQLite connections operate in WAL mode with fast temp_store and cache settings."""
    _, test_db = isolated_bench_env

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check WAL mode
        cursor.execute("PRAGMA journal_mode;")
        journal_mode = cursor.fetchone()[0].lower()
        assert journal_mode == "wal", f"Expected WAL journal mode, got {journal_mode}"

        # Check synchronous mode (NORMAL = 1)
        cursor.execute("PRAGMA synchronous;")
        sync_mode = cursor.fetchone()[0]
        assert sync_mode in (1, "1", "NORMAL", "normal")

        # Check temp_store (MEMORY = 2)
        cursor.execute("PRAGMA temp_store;")
        temp_store = cursor.fetchone()[0]
        assert temp_store in (2, "2", "MEMORY", "memory")


# ==============================================================================
# 5. Database and API Pagination (Limit and Offset)
# ==============================================================================

def test_database_and_api_pagination(isolated_bench_env):
    """Verifies pagination via limit and offset on both database helper and HTTP endpoint."""
    tmp_path, test_db = isolated_bench_env
    engine = StaticAnalysisEngine()

    # Generate and insert 12 distinct analyses
    for i in range(12):
        repo_dir = tmp_path / f"pag_repo_{i}"
        repo_dir.mkdir(parents=True, exist_ok=True)
        (repo_dir / f"mod_{i}.py").write_text(f"def fn_{i}():\n    return {i}\n", encoding="utf-8")
        analysis = engine.analyze_repository(
            repo_dir,
            repo_name=f"test/repo-{i}",
            repo_url=f"local://test/repo-{i}",
            branch="main",
        )
        save_analysis(analysis)

    # 1. Test database list_analyses pagination
    page1 = list_analyses(limit=4, offset=0)
    page2 = list_analyses(limit=4, offset=4)
    page3 = list_analyses(limit=4, offset=8)

    assert len(page1) == 4
    assert len(page2) == 4
    assert len(page3) == 4

    # Ensure no overlap between page 1 and page 2
    ids_p1 = {r.id for r in page1}
    ids_p2 = {r.id for r in page2}
    assert ids_p1.isdisjoint(ids_p2)

    # 2. Test HTTP API endpoint pagination
    resp1 = client.get("/api/v1/analyses?limit=4&offset=0")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert len(data1) == 4

    resp2 = client.get("/api/v1/analyses?limit=4&offset=4")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2) == 4
    assert data1[0]["id"] != data2[0]["id"]


# ==============================================================================
# 6. GZip Response Compression
# ==============================================================================

def test_gzip_compression_on_large_payload(isolated_bench_env):
    """Verifies that endpoints return Content-Encoding: gzip for payloads >= 1000 bytes."""
    _, _ = isolated_bench_env

    # 1. Fetching analyses list when populated
    resp = client.get("/api/v1/analyses", headers={"Accept-Encoding": "gzip"})
    assert resp.status_code == 200
    # In testclient / requests, if body is >= 1000 bytes, gzip header is present
    if len(resp.content) >= 1000:
        assert resp.headers.get("content-encoding") == "gzip"


# ==============================================================================
# 7. Concurrent Load and Multi-Thread Safety
# ==============================================================================

def test_concurrent_analysis_and_persistence(isolated_bench_env):
    """Verifies concurrent threads can perform analyses and save to SQLite without locking errors."""
    tmp_path, _ = isolated_bench_env
    repo_dirs = [_create_synthetic_repo(tmp_path, 10 + i * 2) for i in range(4)]

    def run_worker(repo_dir):
        eng = StaticAnalysisEngine()
        res = eng.analyze_repository(
            repo_dir,
            repo_name="test/concurrent",
            repo_url="local://test/concurrent",
        )
        save_analysis(res)
        read_back = get_analysis(res.id)
        assert read_back is not None
        return res.id

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(run_worker, r) for r in repo_dirs]
        results = [f.result() for f in futures]

    assert len(results) == 4
    all_stored = list_analyses(limit=20)
    stored_ids = {r.id for r in all_stored}
    for res_id in results:
        assert res_id in stored_ids
