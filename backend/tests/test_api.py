"""Tests for FastAPI versioned endpoints."""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_health_endpoint():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "python" in data["supported_languages"]


def test_analyze_local_valid_repo():
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
    circ_path = str(FIXTURES_DIR / "circular_repo")
    res = client.post("/api/v1/analyze", json={"local_path": circ_path})
    assert res.status_code == 200
    data = res.json()

    # Should detect circular dependency
    circular_findings = [f for f in data["findings"] if f["rule_id"] == "architecture/circular-dependency"]
    assert len(circular_findings) >= 1
    assert circular_findings[0]["severity"] == "critical"
    assert data["architecture"]["metrics"]["circular_cycles_count"] >= 1


def test_analyze_local_duplicate_repo():
    dup_path = str(FIXTURES_DIR / "duplicate_repo")
    res = client.post("/api/v1/analyze", json={"local_path": dup_path})
    assert res.status_code == 200
    data = res.json()

    dup_findings = [f for f in data["findings"] if f["rule_id"] == "duplication/block-match"]
    assert len(dup_findings) >= 1
    assert data["indicators"][1]["id"] == "duplication"
    assert data["indicators"][1]["raw_values"]["duplicate_blocks_count"] >= 1


def test_analyze_local_syntax_error_repo():
    err_path = str(FIXTURES_DIR / "syntax_error_repo")
    res = client.post("/api/v1/analyze", json={"local_path": err_path})
    assert res.status_code == 200
    data = res.json()

    # Syntax error recorded as finding without aborting whole repo
    syntax_findings = [f for f in data["findings"] if f["rule_id"] == "syntax/parse-error"]
    assert len(syntax_findings) >= 1
    assert syntax_findings[0]["severity"] == "critical"
    assert data["repository"]["files_examined"] == 2


def test_analyze_empty_repo():
    empty_path = str(FIXTURES_DIR / "empty_repo")
    res = client.post("/api/v1/analyze", json={"local_path": empty_path})
    assert res.status_code == 200
    data = res.json()
    assert data["repository"]["files_examined"] == 0
    assert data["summary"]["cmdi"] == 0.0


def test_analyze_invalid_github_url_fails():
    res = client.post("/api/v1/analyze", json={"repository_url": "http://insecure-domain.org/foo/bar"})
    assert res.status_code == 400
    assert "Insecure Protocol" in res.json()["detail"]


def test_analyze_credential_url_fails():
    res = client.post("/api/v1/analyze", json={"repository_url": "https://admin:pass@github.com/owner/repo"})
    assert res.status_code == 400
    assert "Security Warning" in res.json()["detail"]


def test_analyses_history_endpoints():
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

    # Delete
    del_res = client.delete(f"/api/v1/analyses/{analysis_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Verify deleted
    get_after_del = client.get(f"/api/v1/analyses/{analysis_id}")
    assert get_after_del.status_code == 404
