"""Comprehensive Local Directory Security Hardening Tests (Phase 3).

Covers all 12 Phase 3 security requirements:
1. Local analysis enabled inside authorized workspace.
2. Local analysis disabled.
3. Directory outside authorized workspace.
4. Parent-directory traversal.
5. Nonexistent directory.
6. Regular file supplied instead of a directory.
7. Symlink pointing outside workspace.
8. Symlink loop.
9. Nested authorized directory.
10. Multiple configured workspaces.
11. Windows-style path behavior (casing and separators).
12. Production mode with local analysis disabled.
"""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.ingestion.downloader import SecureRepositoryIngester, IngestionError
from app.ingestion.validator import (
    is_path_within_workspace,
    is_path_in_any_authorized_workspace,
    validate_local_path,
)

client = TestClient(app)


# 1. Local analysis enabled inside authorized workspace
def test_local_analysis_enabled_inside_workspace(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    ws.mkdir()
    (ws / "main.py").write_text("def run():\n    return 42\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    res = ingester.ingest_local_directory(str(ws))
    assert res == ws
    assert (res / "main.py").exists()


# 2. Local analysis disabled
def test_local_analysis_disabled(tmp_path, monkeypatch):
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "app.py").write_text("x = 10\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", False)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="disabled"):
        ingester.ingest_local_directory(str(ws))


# 3. Directory outside authorized workspace
def test_directory_outside_authorized_workspace(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    ws.mkdir()

    outside = tmp_path / "unauthorized_secret"
    outside.mkdir()
    (outside / "secret.py").write_text("db_pass = 'topsecret'\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="outside authorized workspace boundaries"):
        ingester.ingest_local_directory(str(outside))


# 4. Parent-directory traversal
def test_parent_directory_traversal(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    sub = ws / "nested" / "deep"
    sub.mkdir(parents=True)

    outside = tmp_path / "outside_dir"
    outside.mkdir()
    (outside / "data.py").write_text("x = 1\n")

    traversal_path = str(sub / ".." / ".." / ".." / "outside_dir")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="outside authorized workspace boundaries"):
        ingester.ingest_local_directory(traversal_path)


# 5. Nonexistent directory
def test_nonexistent_directory_inside_workspace(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    ws.mkdir()
    nonexistent = ws / "missing_folder_123"

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="does not exist"):
        ingester.ingest_local_directory(str(nonexistent))


# 6. Regular file supplied instead of a directory
def test_regular_file_supplied_instead_of_directory(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    ws.mkdir()
    file_path = ws / "single_file.py"
    file_path.write_text("x = 42\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="not a directory"):
        ingester.ingest_local_directory(str(file_path))


# 7. Symlink pointing outside workspace
def test_symlink_pointing_outside_workspace(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    ws.mkdir()
    (ws / "valid.py").write_text("x = 1\n")

    outside = tmp_path / "outside_secret"
    outside.mkdir()
    (outside / "sensitive.py").write_text("secret = True\n")

    link_path = ws / "leak_link.py"

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    try:
        link_path.symlink_to(outside / "sensitive.py")
    except OSError:
        # Fallback to mock on systems where non-elevated symlinks are restricted
        original_is_symlink = Path.is_symlink
        original_resolve = Path.resolve

        def mock_is_symlink(self):
            if self.name == "leak_link.py":
                return True
            return original_is_symlink(self)

        def mock_resolve(self, *args, **kwargs):
            if self.name == "leak_link.py":
                return (outside / "sensitive.py").resolve()
            return original_resolve(self, *args, **kwargs)

        monkeypatch.setattr(Path, "is_symlink", mock_is_symlink)
        monkeypatch.setattr(Path, "resolve", mock_resolve)
        link_path.touch()

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="Security violation.*outside authorized boundaries"):
        ingester.ingest_local_directory(str(ws))


# 8. Symlink loop
def test_symlink_loop_rejected(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    ws.mkdir()
    (ws / "valid.py").write_text("x = 1\n")

    loop_path = ws / "cycle_link.py"
    loop_path.touch()

    original_is_symlink = Path.is_symlink
    original_resolve = Path.resolve

    def mock_is_symlink(self):
        if self.name == "cycle_link.py":
            return True
        return original_is_symlink(self)

    def mock_resolve(self, *args, **kwargs):
        if self.name == "cycle_link.py":
            raise RuntimeError("Symlink cycle loop detected")
        return original_resolve(self, *args, **kwargs)

    monkeypatch.setattr(Path, "is_symlink", mock_is_symlink)
    monkeypatch.setattr(Path, "resolve", mock_resolve)
    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="Symlink cycle or invalid link detected"):
        ingester.ingest_local_directory(str(ws))


# 9. Nested authorized directory
def test_nested_authorized_directory(tmp_path, monkeypatch):
    ws = tmp_path / "authorized_workspace"
    nested = ws / "services" / "billing"
    nested.mkdir(parents=True)
    (nested / "billing.py").write_text("def bill(): pass\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    res = ingester.ingest_local_directory(str(nested))
    assert res == nested
    assert (res / "billing.py").exists()


# 10. Multiple configured workspaces
def test_multiple_configured_workspaces(tmp_path, monkeypatch):
    ws1 = tmp_path / "workspace_one"
    ws2 = tmp_path / "workspace_two"
    outside = tmp_path / "workspace_three"

    ws1.mkdir()
    (ws1 / "a.py").write_text("x = 1\n")
    ws2.mkdir()
    (ws2 / "b.py").write_text("y = 2\n")
    outside.mkdir()
    (outside / "c.py").write_text("z = 3\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws1, ws2])

    ingester = SecureRepositoryIngester()
    # Both ws1 and ws2 must be accepted
    assert ingester.ingest_local_directory(str(ws1)) == ws1
    assert ingester.ingest_local_directory(str(ws2)) == ws2

    # outside must be rejected
    with pytest.raises(IngestionError, match="outside authorized workspace boundaries"):
        ingester.ingest_local_directory(str(outside))


# 11. Windows-style path behavior where testable
def test_windows_style_path_behavior(tmp_path, monkeypatch):
    ws = tmp_path / "Case_Insensitive_WS"
    ws.mkdir()
    (ws / "calc.py").write_text("def add(a, b): return a + b\n")

    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    # Test inverted case string
    ws_str = str(ws)
    cased_str = ws_str.lower() if ws_str != ws_str.lower() else ws_str.upper()

    ingester = SecureRepositoryIngester()
    res = ingester.ingest_local_directory(cased_str)
    assert res.resolve() == ws.resolve()

    # Test prefix attack protection: e.g. ws + "_extra"
    fake_prefix_dir = tmp_path / (ws.name + "_extra")
    fake_prefix_dir.mkdir()
    (fake_prefix_dir / "attack.py").write_text("p = 1\n")

    with pytest.raises(IngestionError, match="outside authorized workspace boundaries"):
        ingester.ingest_local_directory(str(fake_prefix_dir))


# 12. Production mode with local analysis disabled
def test_production_mode_with_local_analysis_disabled(tmp_path, monkeypatch):
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "prod.py").write_text("prod = True\n")

    monkeypatch.setattr(config, "ENVIRONMENT", "production")
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", False)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [ws])

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="disabled"):
        ingester.ingest_local_directory(str(ws))

    # Also test API endpoint returns 403 Forbidden
    res = client.post("/api/v1/analyze", json={"local_path": str(ws)})
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"]


# Additional Workspace Configuration Validation Tests
def test_workspace_configuration_validation(tmp_path, monkeypatch):
    # Test nonexistent workspace directory detection
    missing_ws = tmp_path / "does_not_exist_ws"
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [missing_ws])

    is_valid, issues = config.validate_workspace_configuration()
    assert is_valid is False
    assert any("does not exist" in issue for issue in issues)

    # Test root filesystem safety alert in production
    root_ws = Path(Path.cwd().anchor)
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    monkeypatch.setattr(config, "ALLOWED_LOCAL_WORKSPACES", [root_ws])

    is_valid, issues = config.validate_workspace_configuration()
    assert is_valid is False
    assert any("Root filesystem" in issue for issue in issues)
