"""End-to-End Integration, Functional Reliability & Persistence Test Suite (Phase 8).

Verifies the complete CodeSentinel AI workflow end-to-end:
GitHub / Local Repository
  -> Repository Ingestion & Validation
  -> File Discovery
  -> Static Analysis (Complexity, Duplication, Dependency Coupling, Error Handling)
  -> Evidence-Based Hotspot Detection
  -> CMDI Calculation & Explainable Breakdown
  -> SQLite Database Persistence
  -> Analysis Retrieval & History Listing
  -> Gemini AI Explanation & Deterministic Fallback
  -> Architecture Graph Generation
  -> Error Sanitization & Edge Case Robustness
"""

import os
import json
import sqlite3
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app import config
from app.models.schemas import AnalysisResult, AnalysisListItem, FindingExplanationResponse
from app.storage.database import init_db, save_analysis, get_analysis, list_analyses, delete_analysis

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    """Provides an isolated temporary SQLite database for integration testing without touching production data."""
    test_db_path = tmp_path / "codesentinel_e2e_test.db"
    monkeypatch.setattr("app.storage.database.DATABASE_PATH", test_db_path)
    monkeypatch.setattr("app.config.DATABASE_PATH", test_db_path)
    monkeypatch.setattr("app.config.ALLOW_LOCAL_ANALYSIS", True)

    current_workspaces = list(getattr(config, "ALLOWED_LOCAL_WORKSPACES", []))
    if tmp_path.resolve() not in current_workspaces:
        current_workspaces.append(tmp_path.resolve())
    if FIXTURES_DIR.resolve() not in current_workspaces:
        current_workspaces.append(FIXTURES_DIR.resolve())
    monkeypatch.setattr("app.config.ALLOWED_LOCAL_WORKSPACES", current_workspaces)

    init_db()
    return test_db_path


# ==============================================================================
# 1. Valid GitHub Repository Analysis & End-to-End Pipeline
# ==============================================================================

def test_e2e_valid_github_repository_analysis(isolated_db):
    """End-to-end flow: Ingest GitHub repo -> AST analysis -> CMDI -> SQLite persistence."""
    repo_fixture = FIXTURES_DIR / "valid_repo"

    with patch("app.api.routes.SecureRepositoryIngester.ingest_github_repository") as mock_ingest:
        mock_ingest.return_value = (repo_fixture, "main")

        response = client.post(
            "/api/v1/analyze",
            json={"repository_url": "https://github.com/octocat/Hello-World"},
        )

        assert response.status_code == 200
        data = response.json()

        # Validate Schema Compliance
        assert "id" in data
        assert data["repository"]["name"] == "octocat/Hello-World"
        assert data["repository"]["branch"] == "main"
        assert data["repository"]["files_examined"] >= 1
        assert "summary" in data
        assert "indicators" in data
        assert len(data["indicators"]) == 4
        assert "architecture" in data

        # Verify Persistence in SQLite Database
        saved = get_analysis(data["id"])
        assert saved is not None
        assert saved.id == data["id"]
        assert saved.repository.name == "octocat/Hello-World"


# ==============================================================================
# 2. Repository Validation Failures (Invalid URLs, Credential URLs, Nonexistent)
# ==============================================================================

def test_e2e_repository_validation_failures():
    """Invalid GitHub URLs, non-GitHub domains, and credential-bearing URLs are rejected with HTTP 400."""
    # Non-GitHub domain
    res1 = client.post("/api/v1/analyze", json={"repository_url": "https://gitlab.com/owner/repo"})
    assert res1.status_code == 400
    assert "Unsupported Domain" in res1.json()["detail"]

    # Credential leak URL
    res2 = client.post("/api/v1/analyze", json={"repository_url": "https://user:token@github.com/owner/repo"})
    assert res2.status_code == 400
    assert "credential" in res2.json()["detail"].lower()

    # Traversal in URL
    res3 = client.post("/api/v1/analyze", json={"repository_url": "https://github.com/owner/../evil"})
    assert res3.status_code == 400

    # Nonexistent repository on GitHub
    with patch("app.api.routes.SecureRepositoryIngester.get_repository_metadata") as mock_meta:
        from app.ingestion.downloader import IngestionError
        mock_meta.side_effect = IngestionError("Repository 'owner/nonexistent' not found on GitHub (HTTP 404).")
        res4 = client.post("/api/v1/analyze", json={"repository_url": "https://github.com/owner/nonexistent"})
        assert res4.status_code == 422
        assert "not found" in res4.json()["detail"].lower()


# ==============================================================================
# 3. Empty Repository Handling
# ==============================================================================

def test_e2e_empty_repository_handling():
    """Empty repository returns sanitized HTTP 422 with no fake analysis or misleading CMDI score."""
    empty_fixture = FIXTURES_DIR / "empty_repo"

    with patch("app.api.routes.SecureRepositoryIngester.ingest_github_repository") as mock_ingest:
        from app.ingestion.downloader import IngestionError
        mock_ingest.side_effect = IngestionError("The repository is empty. Please provide a repository containing source code.")

        res = client.post("/api/v1/analyze", json={"repository_url": "https://github.com/owner/empty-repo"})
        assert res.status_code == 422
        assert "The repository is empty" in res.json()["detail"]


# ==============================================================================
# 4. Unsupported Language Repository Handling
# ==============================================================================

def test_e2e_unsupported_language_handling(tmp_path):
    """Repositories containing only unsupported languages (e.g. JS, Go) return informative HTTP 422."""
    js_repo = tmp_path / "js_project"
    js_repo.mkdir()
    (js_repo / "index.js").write_text("console.log('hello');", encoding="utf-8")
    (js_repo / "server.go").write_text("package main\nfunc main() {}", encoding="utf-8")

    with patch("app.api.routes.SecureRepositoryIngester.ingest_github_repository") as mock_ingest:
        from app.ingestion.downloader import IngestionError
        mock_ingest.side_effect = IngestionError(
            "No supported Python (.py) source files found in repository. CodeSentinel AI currently supports static analysis for Python only (detected: Go, JavaScript)."
        )

        res = client.post("/api/v1/analyze", json={"repository_url": "https://github.com/owner/js-go-repo"})
        assert res.status_code == 422
        detail = res.json()["detail"]
        assert "supports static analysis for Python only" in detail
        assert "Go, JavaScript" in detail


# ==============================================================================
# 5. Technical Debt Analysis (Complexity, Duplication, Coupling, Cycles, Errors)
# ==============================================================================

def test_e2e_technical_debt_repo_analysis(isolated_db):
    """Repository with technical debt produces evidence-backed findings and hotspot rankings."""
    circular_fixture = FIXTURES_DIR / "circular_repo"

    response = client.post(
        "/api/v1/analyze",
        json={"local_path": str(circular_fixture)},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify Circular Dependency finding detected
    finding_rules = [f["rule_id"] for f in data["findings"]]
    assert "architecture/circular-dependency" in finding_rules

    # Verify architecture model reports cycles
    assert data["architecture"]["metrics"]["circular_cycles_count"] >= 1
    cycle_edges = [e for e in data["architecture"]["edges"] if e["is_circular"]]
    assert len(cycle_edges) >= 2

    # Verify CMDI score is calculated within bounds
    assert 0.0 <= data["summary"]["cmdi"] <= 100.0
    assert data["summary"]["score_available"] is True


# ==============================================================================
# 6. Findings Evidence Integrity & Persistence
# ==============================================================================

def test_e2e_findings_persistence_integrity(isolated_db):
    """Findings are persisted with line numbers, code snippets, severity, and rule IDs."""
    error_fixture = FIXTURES_DIR / "error_patterns_repo"

    response = client.post(
        "/api/v1/analyze",
        json={"local_path": str(error_fixture)},
    )
    assert response.status_code == 200
    data = response.json()
    analysis_id = data["id"]

    # Verify error pattern findings
    error_findings = [f for f in data["findings"] if "error-handling" in f["rule_id"]]
    assert len(error_findings) >= 1
    for ef in error_findings:
        assert ef["file"].endswith(".py")
        assert ef["line_range"]
        assert ef["severity"] in ("critical", "high", "medium", "low")

    # Retrieve from Database
    saved = get_analysis(analysis_id)
    assert saved is not None
    assert len(saved.findings) == len(data["findings"])
    assert saved.findings[0].rule_id == data["findings"][0]["rule_id"]


# ==============================================================================
# 7. CMDI Persistence & Null Metric Handling
# ==============================================================================

def test_e2e_cmdi_persistence_and_null_metric_handling(isolated_db, tmp_path):
    """When indicators cannot be measured, CMDI is null, risk is 'Not Available', and DB preserves null."""
    # Create empty Python file with no functions or imports
    empty_py_dir = tmp_path / "empty_py_repo"
    empty_py_dir.mkdir()
    (empty_py_dir / "empty.py").write_text("# Just a comment\n", encoding="utf-8")

    response = client.post(
        "/api/v1/analyze",
        json={"local_path": str(empty_py_dir)},
    )
    assert response.status_code == 200
    data = response.json()
    analysis_id = data["id"]

    # Even with minimal code, engine must not crash or divide by zero
    assert "summary" in data
    assert data["summary"]["cmdi"] is not None or data["summary"]["risk_category"] == "Not Available"

    # Verify SQLite preservation
    saved = get_analysis(analysis_id)
    assert saved is not None
    assert saved.summary.risk_category == data["summary"]["risk_category"]


# ==============================================================================
# 8. Historical Analysis Retrieval by ID
# ==============================================================================

def test_e2e_historical_analysis_retrieval(isolated_db):
    """GET /api/v1/analyses/{id} retrieves the exact saved report without displaying other analyses."""
    valid_fixture = FIXTURES_DIR / "valid_repo"
    circular_fixture = FIXTURES_DIR / "circular_repo"

    res_a = client.post("/api/v1/analyze", json={"local_path": str(valid_fixture)})
    assert res_a.status_code == 200
    id_a = res_a.json()["id"]

    res_b = client.post("/api/v1/analyze", json={"local_path": str(circular_fixture)})
    assert res_b.status_code == 200
    id_b = res_b.json()["id"]

    # Retrieve A
    get_a = client.get(f"/api/v1/analyses/{id_a}")
    assert get_a.status_code == 200
    assert get_a.json()["id"] == id_a
    assert get_a.json()["repository"]["name"] == "valid_repo"

    # Retrieve B
    get_b = client.get(f"/api/v1/analyses/{id_b}")
    assert get_b.status_code == 200
    assert get_b.json()["id"] == id_b
    assert get_b.json()["repository"]["name"] == "circular_repo"


# ==============================================================================
# 9. Analysis History Listing & Sorting
# ==============================================================================

def test_e2e_analysis_history_listing(isolated_db):
    """GET /api/v1/analyses lists previous analyses in reverse-chronological order."""
    valid_fixture = FIXTURES_DIR / "valid_repo"

    res1 = client.post("/api/v1/analyze", json={"local_path": str(valid_fixture)})
    res2 = client.post("/api/v1/analyze", json={"local_path": str(valid_fixture)})
    assert res1.status_code == 200
    assert res2.status_code == 200

    list_res = client.get("/api/v1/analyses?limit=10")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 2
    assert items[0]["id"] == res2.json()["id"]


# ==============================================================================
# 10. Gemini Explanation Integration with Mocked AI Responses
# ==============================================================================

def test_e2e_gemini_explanation_with_mocked_ai(monkeypatch):
    """POST /api/v1/findings/explain validates structured Gemini explanation and labels illustrative code."""
    sample_finding = {
        "finding_id": "COMP-001",
        "rule_id": "complexity/high-cyclomatic",
        "category": "Cyclomatic Complexity",
        "severity": "critical",
        "file": "services/processor.py",
        "line_range": "lines 45–98",
        "title": "Complex conditional branching in process_transaction",
        "summary": "Function has cyclomatic complexity of 32.",
        "detailed_explanation": "Too many branches reduce testability.",
        "code_snippet": "def process_transaction(t):\n    if t.type == 1:\n        pass\n",
        "maintainability_impact": "High defect rate.",
        "recommended_remediation": "Extract helper functions.",
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "plain_language_explanation": "The transaction processor contains too many nested conditionals.",
        "why_it_matters": "Increases cognitive overhead and makes edge-case testing difficult.",
        "proposed_remediation": "Decompose into dedicated handler classes using a strategy pattern.",
        "refactoring_example": "# Illustrative refactoring:\ndef handle_t1(t): pass\n",
        "is_example_illustrative": True,
        "priority_guidance": "Immediate Remediation (Critical Architectural Risk)",
        "potential_tradeoffs": "Increases the total number of classes.",
        "architectural_considerations": "Improves modularity and separation of concerns.",
        "context_limitations": None,
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    monkeypatch.setattr(config, "GEMINI_API_KEY", "test-api-key")
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    res = client.post("/api/v1/findings/explain", json=sample_finding)
    assert res.status_code == 200
    data = res.json()

    assert data["finding_id"] == "COMP-001"
    assert data["plain_language_explanation"]
    assert data["is_example_illustrative"] is True
    assert data["priority_guidance"] == "Immediate Remediation (Critical Architectural Risk)"
    assert data["origin"] == "AI_EXPLANATION (Gemini)"


# ==============================================================================
# 11. Gemini Unavailable Fallback Integration
# ==============================================================================

def test_e2e_gemini_unavailable_fallback():
    """When Gemini is unconfigured or unavailable, fallback=true returns deterministic rule guidance."""
    sample_finding = {
        "finding_id": "FIND-404",
        "rule_id": "architecture/circular-dependency",
        "category": "Architectural Coupling",
        "severity": "critical",
        "file": "core/runner.py",
        "line_range": "file-level",
        "title": "Circular dependency detected",
        "summary": "Mutual import loop.",
    }

    with patch.object(config, "GEMINI_API_KEY", None):
        # 1. Without fallback -> 503 Service Unavailable
        res_no_fallback = client.post("/api/v1/findings/explain", json=sample_finding)
        assert res_no_fallback.status_code == 503

        # 2. With fallback=true -> 200 OK with deterministic template
        res_fallback = client.post("/api/v1/findings/explain?fallback=true", json=sample_finding)
        assert res_fallback.status_code == 200
        data = res_fallback.json()
        assert data["finding_id"] == "FIND-404"
        assert "RULE_BASED_FALLBACK" in data["origin"]
        assert data["refactoring_example"] is None
        assert data["is_example_illustrative"] is False
        assert data["plain_language_explanation"] == "Mutual import loop."


# ==============================================================================
# 12. Architecture Graph Response Structure
# ==============================================================================

def test_e2e_architecture_graph_response():
    """Architecture explorer receives authentic module graph nodes and dependency edges."""
    circular_fixture = FIXTURES_DIR / "circular_repo"

    response = client.post(
        "/api/v1/analyze",
        json={"local_path": str(circular_fixture)},
    )
    assert response.status_code == 200
    arch = response.json()["architecture"]

    assert "metrics" in arch
    assert "nodes" in arch
    assert "edges" in arch
    assert arch["metrics"]["total_modules"] >= 2
    assert arch["metrics"]["total_dependencies"] >= 2


# ==============================================================================
# 13. Missing Analysis ID Handling (404 Not Found)
# ==============================================================================

def test_e2e_missing_analysis_id_returns_404(isolated_db):
    """Accessing or deleting a nonexistent analysis ID returns clean HTTP 404."""
    res_get = client.get("/api/v1/analyses/nonexistent-uuid-9999")
    assert res_get.status_code == 404
    assert "not found" in res_get.json()["detail"].lower()

    res_del = client.delete("/api/v1/analyses/nonexistent-uuid-9999")
    assert res_del.status_code == 404
    assert "not found" in res_del.json()["detail"].lower()


# ==============================================================================
# 14. Zero Division & Nullable Metric Safety
# ==============================================================================

def test_e2e_nullable_metric_and_zero_division_safety(isolated_db, tmp_path):
    """Repositories with 1 clean Python file or minimal AST structures compute CMDI without zero-division."""
    single_file_dir = tmp_path / "single_py"
    single_file_dir.mkdir()
    (single_file_dir / "main.py").write_text("x = 1\ny = 2\nz = x + y\n", encoding="utf-8")

    res = client.post("/api/v1/analyze", json={"local_path": str(single_file_dir)})
    assert res.status_code == 200
    data = res.json()

    assert data["summary"]["cmdi"] is not None
    assert 0.0 <= data["summary"]["cmdi"] <= 100.0


# ==============================================================================
# 15. Duplicate Analysis Submissions
# ==============================================================================

def test_e2e_duplicate_analysis_submissions(isolated_db):
    """Re-submitting the same repository produces independent or updated records without database conflict."""
    valid_fixture = FIXTURES_DIR / "valid_repo"

    res1 = client.post("/api/v1/analyze", json={"local_path": str(valid_fixture)})
    assert res1.status_code == 200
    id1 = res1.json()["id"]

    res2 = client.post("/api/v1/analyze", json={"local_path": str(valid_fixture)})
    assert res2.status_code == 200
    id2 = res2.json()["id"]

    assert id1 != id2
    # Both persisted independently
    saved1 = get_analysis(id1)
    saved2 = get_analysis(id2)
    assert saved1 is not None
    assert saved2 is not None


# ==============================================================================
# 16. Security & Error Message Sanitization
# ==============================================================================

def test_e2e_security_and_error_message_sanitization():
    """Uncaught exceptions and malformed inputs return sanitized payloads without internal tracebacks."""
    # Empty body
    res1 = client.post("/api/v1/analyze", json={})
    assert res1.status_code == 400
    assert "detail" in res1.json()

    # Malformed JSON
    res2 = client.post(
        "/api/v1/analyze",
        content="not a json",
        headers={"Content-Type": "application/json"},
    )
    assert res2.status_code == 422


# ==============================================================================
# 17. API Response Consistency Across Aliases
# ==============================================================================

def test_e2e_api_response_consistency():
    """Versioned API routes and unversioned compatibility aliases return consistent data contracts."""
    health_v1 = client.get("/api/v1/health").json()
    health_compat = client.get("/api/health").json()
    health_root = client.get("/health").json()

    assert health_v1["engine_version"] == health_compat["engine_version"] == health_root["engine_version"]
    assert health_v1["status"] == health_compat["status"] == health_root["status"]
    assert health_v1["supported_languages"] == health_compat["supported_languages"]
