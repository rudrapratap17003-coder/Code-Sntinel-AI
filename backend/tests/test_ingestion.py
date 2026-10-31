"""Tests for repository URL validation and secure ingestion.

Covers all 12 Phase 2 test objectives:
1. Main branch repository.
2. Master branch repository.
3. Custom default branch repository.
4. Invalid repository URL.
5. Nonexistent repository.
6. Empty repository.
7. Repository without Python files.
8. Large repository.
9. Malformed archive.
10. Path traversal archive.
11. GitHub rate-limit response.
12. Network timeout.
"""

import io
import time
import tarfile
import pytest
from pathlib import Path
import httpx

from app import config
from app.ingestion.validator import validate_github_url
from app.ingestion.downloader import SecureRepositoryIngester, IngestionError


def _make_tarball(files: dict, root_dir: str = "test-repo-main") -> bytes:
    """Creates an in-memory .tar.gz archive containing specified files."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for filename, content in files.items():
            full_path = f"{root_dir}/{filename}" if root_dir else filename
            data = content.encode("utf-8") if isinstance(content, str) else content
            ti = tarfile.TarInfo(name=full_path)
            ti.size = len(data)
            ti.mtime = int(time.time())
            tar.addfile(ti, io.BytesIO(data))
    return buf.getvalue()


class MockStreamResponse:
    """Mock for httpx.Client.stream context manager."""
    def __init__(self, status_code: int = 200, content: bytes = b"", headers: dict = None):
        self.status_code = status_code
        self.content = content
        self.headers = headers or {}
        self.text = content.decode("utf-8", errors="ignore") if content else ""

    def iter_bytes(self, chunk_size: int = 65536):
        for i in range(0, len(self.content), chunk_size):
            yield self.content[i : i + chunk_size]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class MockGetResponse:
    """Mock for httpx.Client.get response."""
    def __init__(self, status_code: int = 200, json_data: dict = None, headers: dict = None, text: str = ""):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.headers = headers or {}
        self.text = text or (str(json_data) if json_data else "")

    def json(self):
        return self._json_data


# ==============================================================================
# Base URL Validation Tests
# ==============================================================================

def test_valid_github_url():
    is_valid, err, norm_url, owner, repo = validate_github_url("https://github.com/pallets/flask")
    assert is_valid is True
    assert err is None
    assert norm_url == "https://github.com/pallets/flask"
    assert owner == "pallets"
    assert repo == "flask"


def test_reject_insecure_http_url():
    is_valid, err, _, _, _ = validate_github_url("http://github.com/owner/repo")
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


# ==============================================================================
# Local Directory Ingestion Tests
# ==============================================================================

def test_ingest_local_valid_directory():
    ingester = SecureRepositoryIngester()
    fixture_path = Path(__file__).parent / "fixtures" / "valid_repo"
    resolved = ingester.ingest_local_directory(str(fixture_path))
    assert resolved.exists()
    assert (resolved / "core" / "math_ops.py").exists()


def test_ingest_nonexistent_local_directory():
    ingester = SecureRepositoryIngester()
    nonexistent = str(Path(__file__).parent / "nonexistent_directory_xyz123")
    with pytest.raises(IngestionError, match="does not exist"):
        ingester.ingest_local_directory(nonexistent)


def test_reject_oversized_repository(monkeypatch, tmp_path):
    import app.config as cfg
    monkeypatch.setattr(cfg, "MAX_REPO_SIZE_MB", 0.0001)
    monkeypatch.setattr(cfg, "ALLOWED_LOCAL_WORKSPACES", [tmp_path])

    big_file = tmp_path / "big_module.py"
    big_file.write_text("x = 1\n" * 100)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="exceeds maximum size limit"):
        ingester.ingest_local_directory(str(tmp_path))


def test_safe_non_utf8_file_decoding(tmp_path):
    from app.analyzer.file_discovery import discover_python_files

    latin1_file = tmp_path / "latin1_module.py"
    with open(latin1_file, "wb") as f:
        f.write(b"# Author: Ren\xe9\nx = 42\n")

    discovered, warnings = discover_python_files(tmp_path)
    assert len(discovered) == 1
    assert "x = 42" in discovered[0].content


# ==============================================================================
# Phase 2: 12 Core Objectives Tests
# ==============================================================================

# 1. Main branch repository
def test_ingest_main_branch_repository(monkeypatch):
    tar_bytes = _make_tarball({"main.py": "def run():\n    return 42\n"}, root_dir="myproject-main")

    def mock_get(self, url, *args, **kwargs):
        if "api.github.com/repos" in str(url):
            return MockGetResponse(200, {"default_branch": "main", "size": 120})
        return MockGetResponse(404)

    def mock_stream(self, method, url, *args, **kwargs):
        return MockStreamResponse(200, tar_bytes)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    root, branch = ingester.ingest_github_repository("myorg", "myproject")
    try:
        assert branch == "main"
        assert (root / "main.py").exists()
    finally:
        ingester.cleanup_sandbox(root)


# 2. Master branch repository
def test_ingest_master_branch_repository(monkeypatch):
    tar_bytes = _make_tarball({"app.py": "x = 100\n"}, root_dir="legacy-master")

    def mock_get(self, url, *args, **kwargs):
        if "api.github.com/repos" in str(url):
            return MockGetResponse(200, {"default_branch": "master", "size": 80})
        return MockGetResponse(404)

    def mock_stream(self, method, url, *args, **kwargs):
        return MockStreamResponse(200, tar_bytes)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    root, branch = ingester.ingest_github_repository("myorg", "legacy")
    try:
        assert branch == "master"
        assert (root / "app.py").exists()
    finally:
        ingester.cleanup_sandbox(root)


# 3. Custom default branch repository (e.g., develop, trunk, release-v2)
def test_ingest_custom_default_branch_repository(monkeypatch):
    tar_bytes = _make_tarball({"service.py": "def start(): pass\n"}, root_dir="repo-develop")

    def mock_get(self, url, *args, **kwargs):
        if "api.github.com/repos" in str(url):
            return MockGetResponse(200, {"default_branch": "develop", "size": 250})
        return MockGetResponse(404)

    def mock_stream(self, method, url, *args, **kwargs):
        assert "develop.tar.gz" in str(url) or "HEAD.tar.gz" in str(url)
        return MockStreamResponse(200, tar_bytes)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    root, branch = ingester.ingest_github_repository("myorg", "repo")
    try:
        assert branch == "develop"
        assert (root / "service.py").exists()
    finally:
        ingester.cleanup_sandbox(root)


# 4. Invalid repository URL
def test_invalid_repository_url():
    cases = [
        ("https://gitlab.com/owner/repo", "Unsupported Domain"),
        ("http://github.com/owner/repo", "Insecure Protocol"),
        ("https://user:token@github.com/owner/repo", "Security Warning"),
        ("https://github.com/onlyowner", "Incomplete Path"),
        ("https://github.com/owner/repo<script>", "Invalid Characters"),
        ("", "required"),
    ]
    for url, err_pattern in cases:
        valid, err, _, _, _ = validate_github_url(url)
        assert valid is False
        assert err_pattern.lower() in err.lower()


# 5. Nonexistent repository
def test_ingest_nonexistent_repository(monkeypatch):
    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(404, {"message": "Not Found"})

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="not found"):
        ingester.ingest_github_repository("nonexistent_user", "nonexistent_repo")


# 6. Empty repository (checked via metadata and archive)
def test_ingest_empty_repository_metadata(monkeypatch):
    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(200, {"default_branch": "main", "size": 0})

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="empty"):
        ingester.ingest_github_repository("org", "empty-repo")


def test_ingest_empty_repository_archive(monkeypatch):
    # Archive contains 0 files
    empty_tar = _make_tarball({}, root_dir="empty-repo-main")

    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(200, {"default_branch": "main", "size": 10})

    def mock_stream(self, method, url, *args, **kwargs):
        return MockStreamResponse(200, empty_tar)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="empty"):
        ingester.ingest_github_repository("org", "empty-repo")


# 7. Repository without Python files (e.g. JavaScript, TypeScript, CSS)
def test_ingest_repo_without_python_files(monkeypatch):
    js_tar = _make_tarball(
        {
            "index.js": "console.log('hello');",
            "App.tsx": "export const App = () => <div>App</div>;",
            "styles.css": "body { color: red; }",
        },
        root_dir="frontend-main",
    )

    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(200, {"default_branch": "main", "size": 150})

    def mock_stream(self, method, url, *args, **kwargs):
        return MockStreamResponse(200, js_tar)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError) as exc_info:
        ingester.ingest_github_repository("org", "frontend-app")

    err_msg = str(exc_info.value)
    assert "No supported Python (.py) source files found" in err_msg
    assert "JavaScript" in err_msg or "TypeScript" in err_msg


# 8. Large repository (size limit and file count limit)
def test_ingest_large_repository_exceeds_size(monkeypatch):
    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(200, {"default_branch": "main", "size": 100})

    # Return stream chunks exceeding MAX_REPO_SIZE_MB
    oversized_chunk = b"A" * 1024 * 1024  # 1 MB chunk

    class OversizedStreamResponse(MockStreamResponse):
        def iter_bytes(self, chunk_size=65536):
            # Stream 55 MB, exceeding default 50 MB limit
            for _ in range(55):
                yield oversized_chunk

    def mock_stream(self, method, url, *args, **kwargs):
        return OversizedStreamResponse(200)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="exceeds maximum permitted size"):
        ingester.ingest_github_repository("org", "oversized-repo")


def test_ingest_large_repository_exceeds_files(monkeypatch):
    # Set limit to 5 files
    monkeypatch.setattr(config, "MAX_FILES", 5)

    files_dict = {f"module_{i}.py": f"x = {i}\n" for i in range(10)}
    tar_bytes = _make_tarball(files_dict, root_dir="many-files-main")

    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(200, {"default_branch": "main", "size": 100})

    def mock_stream(self, method, url, *args, **kwargs):
        return MockStreamResponse(200, tar_bytes)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="exceeding the limit of"):
        ingester.ingest_github_repository("org", "too-many-files")


# 9. Malformed archive
def test_ingest_malformed_archive(monkeypatch):
    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(200, {"default_branch": "main", "size": 100})

    def mock_stream(self, method, url, *args, **kwargs):
        # Corrupt data that is not a valid tar or gzip archive
        return MockStreamResponse(200, b"CORRUPTED_NON_TAR_BYTES_12345")

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "stream", mock_stream)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="invalid, corrupted, or in an unsupported format"):
        ingester.ingest_github_repository("org", "corrupt-repo")


# 10. Path traversal archive (Zip Slip / Tar Slip protection)
def test_archive_path_traversal_protection(tmp_path):
    # Craft archive with a member trying directory traversal
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        ti = tarfile.TarInfo(name="../../outside_target.py")
        content = b"malicious_code = True\n"
        ti.size = len(content)
        tar.addfile(ti, io.BytesIO(content))

    archive_file = tmp_path / "traversal.tar.gz"
    archive_file.write_bytes(buf.getvalue())

    dest_dir = tmp_path / "extracted"
    dest_dir.mkdir()

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="Security violation.*traversal"):
        ingester._safe_extract_tar(archive_file, dest_dir)


def test_archive_absolute_path_protection(tmp_path):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        ti = tarfile.TarInfo(name="/etc/cron.d/malicious")
        content = b"* * * * * root reboot\n"
        ti.size = len(content)
        tar.addfile(ti, io.BytesIO(content))

    archive_file = tmp_path / "absolute_path.tar.gz"
    archive_file.write_bytes(buf.getvalue())

    dest_dir = tmp_path / "extracted"
    dest_dir.mkdir()

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="Security violation.*absolute path"):
        ingester._safe_extract_tar(archive_file, dest_dir)


# 11. GitHub rate-limit response
def test_github_rate_limit_response(monkeypatch):
    def mock_get(self, url, *args, **kwargs):
        return MockGetResponse(
            status_code=403,
            headers={"x-ratelimit-remaining": "0"},
            text='{"message": "API rate limit exceeded for IP. Please authenticate."}',
        )

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="rate limit"):
        ingester.ingest_github_repository("org", "rate-limited-repo")


# 12. Network timeout
def test_network_timeout(monkeypatch):
    def mock_get(self, url, *args, **kwargs):
        raise httpx.TimeoutException("Mocked network timeout")

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    ingester = SecureRepositoryIngester()
    with pytest.raises(IngestionError, match="timed out"):
        ingester.ingest_github_repository("org", "timeout-repo")
