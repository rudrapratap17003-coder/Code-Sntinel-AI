"""Tests for repository URL validation and secure ingestion."""

import pytest
from pathlib import Path
from app.ingestion.validator import validate_github_url
from app.ingestion.downloader import SecureRepositoryIngester, IngestionError


def test_valid_github_url():
    is_valid, err, norm_url, owner, repo = validate_github_url("https://github.com/pallets/flask")
    assert is_valid is True
    assert err is None
    assert norm_url == "https://github.com/pallets/flask"
    assert owner == "pallets"
    assert repo == "flask"


def test_reject_insecure_http_url():
    is_valid, err, norm_url, _, _ = validate_github_url("http://github.com/owner/repo")
    assert is_valid is False
    assert "Insecure Protocol" in err


def test_reject_embedded_credentials():
    is_valid, err, _, _, _ = validate_github_url("https://user:password@github.com/owner/repo")
    assert is_valid is False
    assert "Security Warning" in err


def test_reject_non_github_domain():
    is_valid, err, _, _, _ = validate_github_url("https://gitlab.com/owner/repo")
    assert is_valid is False
    assert "Unsupported Domain" in err


def test_reject_path_traversal_in_url():
    is_valid, err, _, _, _ = validate_github_url("https://github.com/owner/../etc/passwd")
    assert is_valid is False


def test_normalize_trailing_slash_and_git():
    is_valid, _, norm_url, owner, repo = validate_github_url("https://github.com/owner/repo.git/")
    assert is_valid is True
    assert norm_url == "https://github.com/owner/repo"
    assert repo == "repo"


def test_ingest_local_valid_directory():
    ingester = SecureRepositoryIngester()
    fixture_path = Path(__file__).parent / "fixtures" / "valid_repo"
    resolved = ingester.ingest_local_directory(str(fixture_path))
    assert resolved.exists()
    assert (resolved / "core" / "math_ops.py").exists()


def test_ingest_nonexistent_local_directory():
    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="does not exist"):
        ingester.ingest_local_directory("/path/to/nonexistent/directory/xyz123")


def test_reject_oversized_repository(monkeypatch, tmp_path):
    # Temporarily set MAX_REPO_SIZE_MB to a tiny threshold
    import app.config as config
    monkeypatch.setattr(config, "MAX_REPO_SIZE_MB", 0.0001)  # ~100 bytes

    # Create dummy file > 100 bytes
    big_file = tmp_path / "big_module.py"
    big_file.write_text("x = 1\n" * 100)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="exceeds maximum size limit"):
        ingester.ingest_local_directory(str(tmp_path))


def test_safe_non_utf8_file_decoding(tmp_path):
    from app.analyzer.file_discovery import discover_python_files

    # Write Latin-1 encoded file with special characters
    latin1_file = tmp_path / "latin1_module.py"
    with open(latin1_file, "wb") as f:
        f.write(b"# Author: Ren\xe9\nx = 42\n")

    discovered, warnings = discover_python_files(tmp_path)
    assert len(discovered) == 1
    assert "x = 42" in discovered[0].content


def test_network_timeout_handling(monkeypatch):
    import httpx

    def mock_get(*args, **kwargs):
        raise httpx.TimeoutException("Mocked network timeout")

    monkeypatch.setattr(httpx.Client, "stream", mock_get)
    ingester = SecureRepositoryIngester()

    with pytest.raises(IngestionError, match="timed out"):
        ingester.ingest_github_repository("owner", "repo")

