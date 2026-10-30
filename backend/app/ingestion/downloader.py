"""Secure Repository Ingestion and Archive Extraction.

Guarantees:
- Never executes code, setup scripts, or builds.
- Never installs dependencies.
- Enforces download size limits, timeouts, file counts, and safe archive extraction.
- Prevents path traversal (Zip Slip) and malicious symlink escapes.
"""

import os
import shutil
import tarfile
import zipfile
import tempfile
from pathlib import Path
from typing import Tuple, Optional
import httpx

from app import config


class IngestionError(Exception):
    """Raised when repository ingestion fails or violates security policy."""
    pass


class SecureRepositoryIngester:
    """Manages secure sandbox ingestion of repository files."""

    def __init__(self, temp_base: Optional[str] = None):
        self.temp_base = temp_base

    def ingest_github_repository(self, owner: str, repo: str, branch: str = "main") -> Tuple[Path, str]:
        """Downloads public repository archive securely from GitHub.
        
        Returns:
            (extracted_path, effective_branch)
        """
        max_bytes = int(config.MAX_REPO_SIZE_MB * 1024 * 1024)
        
        # Candidate branch heads to try
        branches_to_try = [branch]
        if branch != "master":
            branches_to_try.append("master")

        last_error = None
        for candidate in branches_to_try:
            archive_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{candidate}.tar.gz"
            try:
                temp_dir = Path(tempfile.mkdtemp(prefix="codesentinel_ingest_", dir=self.temp_base))
                archive_path = temp_dir / "repo_archive.tar.gz"
                extract_path = temp_dir / "extracted"
                extract_path.mkdir(parents=True, exist_ok=True)

                total_downloaded = 0
                with httpx.Client(timeout=config.DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True) as client:
                    with client.stream("GET", archive_url) as response:
                        if response.status_code == 404:
                            # Try next candidate branch
                            shutil.rmtree(temp_dir, ignore_errors=True)
                            continue
                        if response.status_code != 200:
                            shutil.rmtree(temp_dir, ignore_errors=True)
                            raise IngestionError(
                                f"GitHub returned HTTP {response.status_code} while fetching {archive_url}."
                            )

                        with open(archive_path, "wb") as f:
                            for chunk in response.iter_bytes(chunk_size=65536):
                                total_downloaded += len(chunk)
                                if total_downloaded > max_bytes:
                                    shutil.rmtree(temp_dir, ignore_errors=True)
                                    raise IngestionError(
                                        f"Repository archive exceeds maximum permitted size of {config.MAX_REPO_SIZE_MB} MB."
                                    )
                                f.write(chunk)

                # Extract safely
                self._safe_extract_tar(archive_path, extract_path)

                # Find the root extracted repository directory
                contents = list(extract_path.iterdir())
                repo_root = contents[0] if len(contents) == 1 and contents[0].is_dir() else extract_path

                # Validate file count
                file_count = sum(1 for _ in repo_root.rglob("*.py"))
                if file_count > config.MAX_FILES:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    raise IngestionError(
                        f"Repository contains {file_count} Python files, exceeding the limit of {config.MAX_FILES} files."
                    )

                return repo_root, candidate

            except httpx.TimeoutException:
                shutil.rmtree(temp_dir, ignore_errors=True)
                raise IngestionError(
                    f"Connection timed out while downloading repository from GitHub ({config.DOWNLOAD_TIMEOUT_SECONDS}s limit)."
                )
            except Exception as e:
                shutil.rmtree(temp_dir, ignore_errors=True)
                last_error = e

        if last_error:
            if isinstance(last_error, IngestionError):
                raise last_error
            raise IngestionError(f"Failed to ingest GitHub repository: {str(last_error)}")

        raise IngestionError(
            f"Repository {owner}/{repo} not found on branch '{branch}' (also tried 'master'). Please check repository visibility."
        )

    def ingest_local_directory(self, local_path_str: str) -> Path:
        """Validates and stages a local directory for analysis."""
        path = Path(local_path_str).resolve()
        if not path.exists():
            raise IngestionError(f"Local path does not exist: {local_path_str}")
        if not path.is_dir():
            raise IngestionError(f"Local path is not a directory: {local_path_str}")

        # Check total size
        total_size = 0
        file_count = 0
        max_bytes = int(config.MAX_REPO_SIZE_MB * 1024 * 1024)

        for root, dirs, files in os.walk(path, followlinks=False):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in (".git", ".venv", "venv", "__pycache__", "node_modules")]
            for f in files:
                full_f = Path(root) / f
                if full_f.is_symlink():
                    # Validate symlink doesn't escape repository root
                    try:
                        resolved = full_f.resolve()
                        if not resolved.is_relative_to(path):
                            raise IngestionError(
                                f"Security Warning: Symlink {full_f.name} points outside repository boundaries ({resolved})."
                            )
                    except Exception:
                        continue

                try:
                    total_size += full_f.stat().st_size
                except OSError:
                    continue

                if total_size > max_bytes:
                    raise IngestionError(f"Repository exceeds maximum size limit of {config.MAX_REPO_SIZE_MB} MB.")

                if f.endswith(".py"):
                    file_count += 1
                    if file_count > config.MAX_FILES:
                        raise IngestionError(
                            f"Repository contains {file_count}+ Python files, exceeding limit of {config.MAX_FILES}."
                        )

        return path

    def _safe_extract_tar(self, tar_path: Path, dest_dir: Path) -> None:
        """Extracts a tar archive with strict path traversal and symlink guards."""
        dest_resolved = dest_dir.resolve()

        with tarfile.open(tar_path, "r:*") as tar:
            for member in tar.getmembers():
                # 1. Path traversal check (Zip Slip / Tar Slip)
                member_target = (dest_dir / member.name).resolve()
                if not member_target.is_relative_to(dest_resolved):
                    raise IngestionError(
                        f"Security violation: Archive member '{member.name}' attempts directory traversal outside destination."
                    )

                # 2. Symlink & Hardlink validation
                if member.issym() or member.islnk():
                    # For symlinks, verify link target does not point outside dest_dir
                    link_target = member.linkname
                    if os.path.isabs(link_target) or ".." in link_target:
                        resolved_link = (dest_dir / os.path.dirname(member.name) / link_target).resolve()
                        if not resolved_link.is_relative_to(dest_resolved):
                            # Skip malicious symlink
                            continue

                tar.extract(member, path=dest_dir)

    def cleanup_sandbox(self, path: Path) -> None:
        """Safely removes a temporary ingestion directory."""
        try:
            # Find the top-level temporary parent directory created by ingester
            if "codesentinel_ingest_" in str(path):
                cur = path
                while cur.parent != cur:
                    if cur.name.startswith("codesentinel_ingest_"):
                        shutil.rmtree(cur, ignore_errors=True)
                        break
                    cur = cur.parent
            elif path.is_dir() and "codesentinel_ingest_" in path.name:
                shutil.rmtree(path, ignore_errors=True)
        except Exception:
            pass
