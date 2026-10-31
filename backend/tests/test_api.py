"""Tests for FastAPI versioned endpoints, error handling, and reliability."""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app import config

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_health_endpoint():
    """Validates primary v1 health endpoint contract."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("healthy", "degraded")
    assert "python" in data["supported_languages"]
    assert "database" in data
    assert "gemini" in data
    assert "limits" in data


def test_health_endpoint_aliases():
    """Validates that /api/health and /health aliases resolve properly without 404."""
    # /api/health compatibility alias
    res_api = client.get("/api/health")
    assert res_api.status_code == 200
    assert res_api.json()["engine_version"] == config.ENGINE_VERSION

    # /health root alias
    res_root = client.get("/health")
    assert res_root.status_code == 200
    assert res_root.json()["engine_version"] == config.ENGINE_VERSION

    # / root service index
    res_index = client.get("/")
    assert res_index.status_code == 200
    assert res_index.json()["docs_url"] == "/docs"


def test_analyze_rejects_missing_both_targets():
    """Endpoint returns 400 when neither repository_url nor local_path is provided."""
    res1 = client.post("/api/v1/analyze", json={})
    assert res1.status_code == 400
    assert "Must provide either 'repository_url' or 'local_path'" in res1.json()["detail"]

    # Whitespace-only targets are also rejected
    res2 = client.post("/api/v1/analyze", json={"repository_url": "   ", "local_path": ""})
    assert res2.status_code == 400
    assert "Must provide either 'repository_url' or 'local_path'" in res2.json()["detail"]


def test_analyze_rejects_both_targets_simultaneously():
    """Endpoint returns 400 when both repository_url and local_path are supplied."""
    res = client.post(
        "/api/v1/analyze",
        json={
            "repository_url": "https://github.com/pallets/flask",
            "local_path": str(FIXTURES_DIR / "valid_repo"),
        },
    )
    assert res.status_code == 400
    assert "Cannot provide both 'repository_url' and 'local_path'" in res.json()["detail"]


def test_analyze_local_valid_repo():
    """Valid local directory produces expected 200 analysis."""
    valid_path = str(FIXTURES_DIR / "valid_repo")
    res = client.post("/api/v1/analyze", json={"local_path": valid_path})
    assert res.status_code == 200
    data = res.json()

    assert data["repository"]["name"] == "valid_repo"
    assert data["repository"]["files_examined"] == 3
    assert data["summary"]["cmdi"] <= 25.0
    assert data["summary"]["risk_category"] == "Low Risk"
    assert len(data["architecture"]["nodes"]) == 3


def test_analyze_local_circular_repo():
    """Circular dependency fixture triggers critical architecture finding."""
    circ_path = str(FIXTURES_DIR / "circular_repo")
    res = client.post("/api/v1/analyze", json={"local_path": circ_path})
    assert res.status_code == 200
    data = res.json()

    circular_findings = [f for f in data["findings"] if f["rule_id"] == "architecture/circular-dependency"]
    assert len(circular_findings) >= 1
    assert circular_findings[0]["severity"] == "critical"
    assert data["architecture"]["metrics"]["circular_cycles_count"] >= 1


def test_analyze_local_duplicate_repo():
    """Duplicate code fixture triggers duplication indicator values."""
    dup_path = str(FIXTURES_DIR / "duplicate_repo")
    res = client.post("/api/v1/analyze", json={"local_path": dup_path})
    assert res.status_code == 200
    data = res.json()

    dup_findings = [f for f in data["findings"] if f["rule_id"] == "duplication/block-match"]
    assert len(dup_findings) >= 1
    assert data["indicators"][1]["id"] == "duplication"
    assert data["indicators"][1]["raw_values"]["duplicate_blocks_count"] >= 1


def test_analyze_local_syntax_error_repo():
    """Syntax errors are captured as findings without terminating entire analysis."""
    err_path = str(FIXTURES_DIR / "syntax_error_repo")
    res = client.post("/api/v1/analyze", json={"local_path": err_path})
    assert res.status_code == 200
    data = res.json()

    syntax_findings = [f for f in data["findings"] if f["rule_id"] == "syntax/parse-error"]
    assert len(syntax_findings) >= 1
    assert syntax_findings[0]["severity"] == "critical"
    assert data["repository"]["files_examined"] == 2


def test_analyze_empty_repo():
    """Repository without Python source returns 422."""
    empty_path = str(FIXTURES_DIR / "empty_repo")
    res = client.post("/api/v1/analyze", json={"local_path": empty_path})
    assert res.status_code == 422
    assert "No supported Python (.py) source files found" in res.json()["detail"]


def test_analyze_invalid_github_url_fails():
    """Non-HTTPS or invalid URLs return 400 Bad Request."""
    res = client.post("/api/v1/analyze", json={"repository_url": "http://insecure-domain.org/foo/bar"})
    assert res.status_code == 400
    assert "Insecure Protocol" in res.json()["detail"]


def test_analyze_credential_url_fails():
    """URLs with embedded credentials return 400 Bad Request."""
    res = client.post("/api/v1/analyze", json={"repository_url": "https://admin:pass@github.com/owner/repo"})
    assert res.status_code == 400
    assert "Security Warning" in res.json()["detail"]


def test_analyze_local_outside_authorized_workspace_returns_403(tmp_path, monkeypatch):
    """Local path outside authorized workspaces returns 403 Forbidden."""
    ws = tmp_path / "authorized_ws"
    ws.mkdir()
    outside = tmp_path / "unauthorized_dir"
    outside.mkdir()
    (outside / "test.py").write_text("x = 1\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    res = client.post("/api/v1/analyze", json={"local_path": str(outside)})
    assert res.status_code == 403
    assert "outside authorized workspace boundaries" in res.json()["detail"]


def test_analyze_local_disabled_returns_403(monkeypatch):
    """When local analysis toggle is disabled, local requests return 403 Forbidden."""
    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", False)

    res = client.post("/api/v1/analyze", json={"local_path": str(FIXTURES_DIR / "valid_repo")})
    assert res.status_code == 403
    assert "Local directory analysis is disabled" in res.json()["detail"]


def test_analyze_local_nonexistent_directory_returns_404(tmp_path, monkeypatch):
    """Nonexistent local directory returns 404 Not Found."""
    ws = tmp_path / "authorized_ws"
    ws.mkdir()

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    nonexistent = str(ws / "ghost_directory")
    res = client.post("/api/v1/analyze", json={"local_path": nonexistent})
    assert res.status_code == 404
    assert "does not exist" in res.json()["detail"]


def test_analyses_history_endpoints():
    """Tests CRUD lifecycle for historical analyses."""
    # Run analysis to ensure at least one record
    valid_path = str(FIXTURES_DIR / "valid_repo")
    post_res = client.post("/api/v1/analyze", json={"local_path": valid_path})
    analysis_id = post_res.json()["id"]

    # List
    list_res = client.get("/api/v1/analyses")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert any(item["id"] == analysis_id for item in items)

    # Get by ID
    get_res = client.get(f"/api/v1/analyses/{analysis_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == analysis_id

    # 404 for unknown ID
    missing_res = client.get("/api/v1/analyses/unknown-id-12345")
    assert missing_res.status_code == 404
    assert "not found" in missing_res.json()["detail"].lower()

    # Delete
    del_res = client.delete(f"/api/v1/analyses/{analysis_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Verify deleted
    get_after_del = client.get(f"/api/v1/analyses/{analysis_id}")
    assert get_after_del.status_code == 404

    # Delete again returns 404
    del_again = client.delete(f"/api/v1/analyses/{analysis_id}")
    assert del_again.status_code == 404


def test_analyses_list_limit_query_param_validation():
    """Limit query parameter enforces validation rules (1 <= limit <= 500)."""
    # Valid limits
    res_valid = client.get("/api/v1/analyses?limit=10")
    assert res_valid.status_code == 200

    # Limit = 0 returns 422
    res_zero = client.get("/api/v1/analyses?limit=0")
    assert res_zero.status_code == 422

    # Negative limit returns 422
    res_neg = client.get("/api/v1/analyses?limit=-5")
    assert res_neg.status_code == 422

    # Limit > 500 returns 422
    res_huge = client.get("/api/v1/analyses?limit=9999")
    assert res_huge.status_code == 422


def test_api_compatibility_alias_routes():
    """Validates that unversioned /api/... endpoints function identically."""
    # /api/analyze
    valid_path = str(FIXTURES_DIR / "valid_repo")
    post_res = client.post("/api/analyze", json={"local_path": valid_path})
    assert post_res.status_code == 200
    analysis_id = post_res.json()["id"]

    # /api/analyses
    list_res = client.get("/api/analyses")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(item["id"] == analysis_id for item in items)

    # /api/analyses/{id}
    get_res = client.get(f"/api/analyses/{analysis_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == analysis_id

    # /api/analyses/{id} DELETE
    del_res = client.delete(f"/api/analyses/{analysis_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"


def test_sanitized_500_gemini_error_does_not_leak_internals(monkeypatch):
    """Unexpected exception in Gemini explanation returns sanitized 500 without leaking credentials or paths."""
    sample_finding = {
        "finding_id": "FIND-PY-001",
        "rule_id": "complexity/high-cyclomatic",
        "category": "Cyclomatic Complexity",
        "severity": "critical",
        "file": "sensitive/auth_manager.py",
        "line_range": "lines 10–20",
        "title": "High Complexity",
        "summary": "Too complex",
    }

    # Simulate an internal error containing sensitive token and filesystem path
    secret_leak_message = "Internal failure: API_KEY=sk_live_secret12345 at /var/secrets/keys.json line 42"
    with patch("app.api.routes.GeminiExplainer.explain_finding", side_effect=RuntimeError(secret_leak_message)):
        res = client.post("/api/v1/findings/explain", json=sample_finding)
        assert res.status_code == 500
        detail = res.json()["detail"]
        assert "sk_live_secret12345" not in detail
        assert "/var/secrets" not in detail
        assert "An unexpected error occurred in the Gemini explanation engine" in detail


def test_sanitized_500_analysis_engine_error_does_not_leak_internals():
    """Unexpected exception in static analysis engine returns sanitized 500."""
    valid_path = str(FIXTURES_DIR / "valid_repo")

    with patch("app.api.routes.StaticAnalysisEngine.analyze_repository", side_effect=RuntimeError("Internal core dump at /opt/engine/ast.c:88")):
        res = client.post("/api/v1/analyze", json={"local_path": valid_path})
        assert res.status_code == 500
        detail = res.json()["detail"]
        assert "/opt/engine" not in detail
        assert "ast.c:88" not in detail
        assert "Local static analysis engine encountered an unexpected error" in detail


def test_database_error_handling_in_crud_endpoints():
    """Database failures return sanitized 500 responses instead of leaking SQLite errors."""
    import sqlite3

    with patch("app.api.routes.list_analyses", side_effect=sqlite3.OperationalError("disk I/O error on /db/corrupt.db")):
        res_list = client.get("/api/v1/analyses")
        assert res_list.status_code == 500
        assert "corrupt.db" not in res_list.json()["detail"]
        assert "Failed to retrieve previous analyses from database." in res_list.json()["detail"]

    with patch("app.api.routes.get_analysis", side_effect=sqlite3.DatabaseError("database disk image is malformed")):
        res_get = client.get("/api/v1/analyses/any-id")
        assert res_get.status_code == 500
        assert "disk image" not in res_get.json()["detail"]
        assert "Failed to retrieve analysis from database." in res_get.json()["detail"]

    with patch("app.api.routes.delete_analysis", side_effect=sqlite3.DatabaseError("database locked")):
        res_del = client.delete("/api/v1/analyses/any-id")
        assert res_del.status_code == 500
        assert "database locked" not in res_del.json()["detail"]
        assert "Failed to delete analysis from database." in res_del.json()["detail"]
