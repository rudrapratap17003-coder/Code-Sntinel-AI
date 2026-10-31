"""Secure Repository Ingestion and Archive Extraction.

Guarantees:
- Never executes code, setup scripts, or builds.
- Never installs dependencies.
- Enforces download size limits, timeouts, file counts, and safe archive extraction.
- Prevents path traversal (Zip Slip / Tar Slip) and malicious symlink escapes.
- Identifies GitHub default branch automatically via repository metadata.
- Validates repository suitability (Python code present, non-empty, within resource caps).
"""

import os
import re
import shutil
import tarfile
import tempfile
from pathlib import Path
from typing import Tuple, Optional, Dict, Any, Set
import httpx

from app import config
from app.ingestion.validator import (
    validate_local_path,
    is_path_within_workspace,
    is_path_in_any_authorized_workspace,
)


class IngestionError(Exception):
    """Raised when repository ingestion fails or violates security policy."""
    pass


LANGUAGE_EXTENSIONS: Dict[str, str] = {
    ".js": "JavaScript",
    ".jsx": "JavaScript (React)",
    ".ts": "TypeScript",
    ".tsx": "TypeScript (React)",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".hpp": "C++ Header",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".scala": "Scala",
    ".html": "HTML",
    ".css": "CSS",
    ".vue": "Vue",
    ".dart": "Dart",
}


def _get_github_headers() -> Dict[str, str]:
    """Generates standard headers for GitHub API and archive requests."""
    headers = {
        "User-Agent": "CodeSentinel-AI/1.0",
        "Accept": "application/vnd.github.v3+json",
    }
    token = getattr(config, "GITHUB_TOKEN", None)
    if token and token.strip():
        headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


class SecureRepositoryIngester:
    """Manages secure sandbox ingestion of repository files."""

    def __init__(self, temp_base: Optional[str] = None):
        self.temp_base = temp_base

    def get_repository_metadata(self, owner: str, repo: str) -> Dict[str, Any]:
        """Retrieves repository metadata from GitHub API to determine default branch and repo status."""
        api_url = f"https://api.github.com/repos/{owner}/{repo}"
        headers = _get_github_headers()

        try:
            with httpx.Client(timeout=config.DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True) as client:
                response = client.get(api_url, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    if data.get("disabled"):
                        raise IngestionError(f"Repository '{owner}/{repo}' is disabled on GitHub.")
                    return data
                elif response.status_code == 404:
                    raise IngestionError(
                        f"Repository '{owner}/{repo}' not found on GitHub. Verify the repository name is correct and that the repository is public."
                    )
                elif response.status_code == 401:
                    raise IngestionError(
                        f"GitHub authentication failed (HTTP 401) while accessing repository '{owner}/{repo}'. Please check your GitHub access token."
                    )
                elif response.status_code == 403:
                    is_rate_limited = (
                        response.headers.get("x-ratelimit-remaining") == "0"
                        or "rate limit" in response.text.lower()
                    )
                    if is_rate_limited:
                        raise IngestionError(
                            "GitHub API rate limit exceeded. Please wait before retrying or configure a GitHub access token."
                        )
                    raise IngestionError(
                        f"Repository '{owner}/{repo}' is private or inaccessible without authorization (HTTP 403)."
                    )
                elif response.status_code == 451:
                    raise IngestionError(
                        f"Repository '{owner}/{repo}' is unavailable due to legal or policy restrictions (HTTP 451)."
                    )
                else:
                    raise IngestionError(
                        f"GitHub returned HTTP {response.status_code} while querying repository metadata for '{owner}/{repo}'."
                    )
        except httpx.TimeoutException:
            raise IngestionError(
                f"Connection timed out while querying GitHub API for repository '{owner}/{repo}' ({config.DOWNLOAD_TIMEOUT_SECONDS}s limit)."
            )
        except IngestionError:
            raise
        except Exception as e:
            raise IngestionError(
                f"Network error while connecting to GitHub API for repository '{owner}/{repo}': {str(e)}"
            )

    def _download_archive(self, url: str, target_file: Path) -> None:
        """Downloads archive stream with strict size and timeout enforcement."""
        max_bytes = int(config.MAX_REPO_SIZE_MB * 1024 * 1024)
        headers = _get_github_headers()

        try:
            with httpx.Client(timeout=config.DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True) as client:
                with client.stream("GET", url, headers=headers) as response:
                    if response.status_code == 404:
                        raise IngestionError(f"Repository archive not found at {url} (HTTP 404).")
                    elif response.status_code == 401:
                        raise IngestionError("GitHub authentication failed (HTTP 401).")
                    elif response.status_code == 403:
                        is_rate_limited = (
                            response.headers.get("x-ratelimit-remaining") == "0"
                            or "rate limit" in response.text.lower()
                        )
                        if is_rate_limited:
                            raise IngestionError(
                                "GitHub rate limit exceeded. Please wait before retrying or configure a GitHub access token."
                            )
                        raise IngestionError(
                            "Access forbidden (HTTP 403) while downloading repository archive. Repository may be private."
                        )
                    elif response.status_code != 200:
                        raise IngestionError(
                            f"GitHub returned HTTP {response.status_code} while fetching {url}."
                        )

                    total_downloaded = 0
                    with open(target_file, "wb") as f:
                        for chunk in response.iter_bytes(chunk_size=65536):
                            total_downloaded += len(chunk)
                            if total_downloaded > max_bytes:
                                raise IngestionError(
                                    f"Repository archive exceeds maximum permitted size of {config.MAX_REPO_SIZE_MB} MB."
                                )
                            f.write(chunk)
        except httpx.TimeoutException:
            raise IngestionError(
                f"Connection timed out while downloading repository from GitHub ({config.DOWNLOAD_TIMEOUT_SECONDS}s limit)."
            )
        except IngestionError:
            raise
        except Exception as e:
            raise IngestionError(f"Network error while downloading repository archive: {str(e)}")

    def ingest_github_repository(self, owner: str, repo: str, branch: Optional[str] = None) -> Tuple[Path, str]:
        """Downloads public repository archive securely from GitHub.

        Returns:
            (extracted_path, effective_branch)
        """
        effective_branch = branch

        # 1. Fetch metadata if branch is not explicitly provided or to validate repository existence
        if not effective_branch or effective_branch == "main":
            metadata = self.get_repository_metadata(owner, repo)
            detected_branch = metadata.get("default_branch")
            if detected_branch:
                effective_branch = detected_branch
            else:
                effective_branch = "main"

            # Check if repo metadata reports 0 KB size (empty repository)
            if metadata.get("size") == 0:
                raise IngestionError(
                    "The repository is empty. Please provide a repository containing source code."
                )

        # 2. Candidate archive URLs
        candidate_urls = [
            (f"https://github.com/{owner}/{repo}/archive/refs/heads/{effective_branch}.tar.gz", effective_branch),
            (f"https://github.com/{owner}/{repo}/archive/HEAD.tar.gz", effective_branch),
        ]

        temp_dir = Path(tempfile.mkdtemp(prefix="codesentinel_ingest_", dir=self.temp_base))
        archive_path = temp_dir / "repo_archive.tar.gz"
        extract_path = temp_dir / "extracted"
        extract_path.mkdir(parents=True, exist_ok=True)

        download_success = False
        last_error = None

        for archive_url, cand_branch in candidate_urls:
            try:
                self._download_archive(archive_url, archive_path)
                download_success = True
                effective_branch = cand_branch
                break
            except IngestionError as ie:
                if "HTTP 404" in str(ie) or "not found" in str(ie).lower():
                    last_error = ie
                    continue
                else:
                    self.cleanup_sandbox(temp_dir)
                    raise ie

        if not download_success:
            self.cleanup_sandbox(temp_dir)
            if last_error:
                raise IngestionError(
                    f"Default branch '{effective_branch}' not found for repository '{owner}/{repo}'. Please check repository settings."
                )
            raise IngestionError(
                f"Failed to download repository archive for '{owner}/{repo}' on branch '{effective_branch}'."
            )

        try:
            # 3. Extract safely
            self._safe_extract_tar(archive_path, extract_path)

            # 4. Validate repository contents (non-empty, contains .py, meets resource limits)
            repo_root = self._validate_extracted_repository(extract_path)

            return repo_root, effective_branch
        except Exception:
            self.cleanup_sandbox(temp_dir)
            raise

    def _safe_extract_tar(self, tar_path: Path, dest_dir: Path) -> None:
        """Extracts a tar archive with strict path traversal, symlink guards, file count, and size caps."""
        if not tarfile.is_tarfile(tar_path):
            raise IngestionError(
                "The repository archive is invalid, corrupted, or in an unsupported format."
            )

        dest_resolved = dest_dir.resolve()
        max_extracted_bytes = int(config.MAX_EXTRACTED_SIZE_MB * 1024 * 1024)
        total_extracted_bytes = 0
        total_extracted_files = 0

        try:
            with tarfile.open(tar_path, "r:*") as tar:
                for member in tar.getmembers():
                    total_extracted_files += 1
                    if total_extracted_files > config.MAX_EXTRACTED_FILES:
                        raise IngestionError(
                            f"Repository archive exceeds maximum extracted file count limit ({config.MAX_EXTRACTED_FILES} files)."
                        )

                    total_extracted_bytes += member.size
                    if total_extracted_bytes > max_extracted_bytes:
                        raise IngestionError(
                            f"Decompressed repository size exceeds maximum limit of {config.MAX_EXTRACTED_SIZE_MB} MB."
                        )

                    # Path traversal & absolute path checks (Tar Slip / Zip Slip)
                    clean_name = member.name.replace("\\", "/")
                    parts = [p for p in clean_name.split("/") if p]

                    if member.name.startswith(("/", "\\")) or re.match(r"^[a-zA-Z]:", member.name):
                        raise IngestionError(
                            f"Security violation: Archive member '{member.name}' contains an absolute path."
                        )
                    if ".." in parts:
                        raise IngestionError(
                            f"Security violation: Archive member '{member.name}' attempts directory traversal outside destination."
                        )

                    member_target = (dest_dir / member.name).resolve()
                    if not member_target.is_relative_to(dest_resolved):
                        raise IngestionError(
                            f"Security violation: Archive member '{member.name}' attempts directory traversal outside destination."
                        )

                    # Directory depth check
                    try:
                        rel_parts = member_target.relative_to(dest_resolved).parts
                        if len(rel_parts) > config.MAX_DIRECTORY_DEPTH:
                            raise IngestionError(
                                f"Repository contains excessive directory nesting depth ({len(rel_parts)} levels), exceeding safe limit of {config.MAX_DIRECTORY_DEPTH}."
                            )
                    except ValueError:
                        pass

                    # Skip device nodes, pipes, symlinks, and hardlinks for security
                    if member.isdev() or member.ischr() or member.isblk() or member.isfifo():
                        continue
                    if member.issym() or member.islnk():
                        continue

                    tar.extract(member, path=dest_dir)
        except IngestionError:
            raise
        except (tarfile.TarError, EOFError, OSError):
            raise IngestionError(
                "The repository archive is invalid, corrupted, or in an unsupported format."
            )

    def _validate_extracted_repository(self, repo_root: Path) -> Path:
        """Validates that repository contains files, contains Python (.py) source code, and meets limits."""
        # Find inner repository folder if wrapped in a single root folder
        contents = [p for p in repo_root.iterdir() if p.name not in (".git", "__MACOSX")]
        if len(contents) == 1 and contents[0].is_dir():
            repo_root = contents[0]

        total_files = 0
        py_files = 0
        found_extensions: Set[str] = set()
        max_bytes = int(config.MAX_REPO_SIZE_MB * 1024 * 1024)
        total_size = 0

        for root, dirs, files in os.walk(repo_root, followlinks=False):
            # 1. Directory symlink & junction inspection (prevent following links outside workspace)
            pruned_dirs = []
            for d in dirs:
                if d in (".git", ".venv", "venv", "__pycache__", "node_modules") or d.endswith(".egg-info"):
                    continue
                dir_path = Path(root) / d
                is_link = dir_path.is_symlink() or (hasattr(os.path, "isjunction") and os.path.isjunction(dir_path))
                if is_link:
                    try:
                        resolved_dir = dir_path.resolve()
                        if not is_path_in_any_authorized_workspace(resolved_dir, config.ALLOWED_LOCAL_WORKSPACES):
                            raise IngestionError(
                                "Security violation: Directory symlink points outside authorized boundaries."
                            )
                    except (OSError, RuntimeError):
                        raise IngestionError("Security violation: Symlink cycle or invalid link detected.")
                pruned_dirs.append(d)
            dirs[:] = pruned_dirs

            try:
                depth = len(Path(root).relative_to(repo_root).parts)
                if depth > config.MAX_DIRECTORY_DEPTH:
                    raise IngestionError(
                        f"Repository contains excessive directory nesting depth ({depth} levels), exceeding safe limit of {config.MAX_DIRECTORY_DEPTH}."
                    )
            except ValueError:
                pass

            for f in files:
                total_files += 1
                full_f = Path(root) / f

                is_link = full_f.is_symlink() or (hasattr(os.path, "isjunction") and os.path.isjunction(full_f))
                if is_link:
                    try:
                        resolved = full_f.resolve()
                        if not is_path_in_any_authorized_workspace(resolved, config.ALLOWED_LOCAL_WORKSPACES):
                            raise IngestionError(
                                "Security violation: Symlink points outside authorized boundaries."
                            )
                    except (OSError, RuntimeError):
                        raise IngestionError("Security violation: Symlink cycle or invalid link detected.")

                ext = full_f.suffix.lower()
                if ext:
                    found_extensions.add(ext)

                try:
                    fsize = full_f.stat().st_size
                    total_size += fsize
                except OSError:
                    continue

                if total_size > max_bytes:
                    raise IngestionError(
                        f"Repository exceeds maximum size limit of {config.MAX_REPO_SIZE_MB} MB."
                    )

                if f.endswith(".py"):
                    py_files += 1

        if total_files == 0:
            raise IngestionError(
                "The repository is empty. Please provide a repository containing source code."
            )

        if py_files == 0:
            detected_languages = {
                LANGUAGE_EXTENSIONS[ext]
                for ext in found_extensions
                if ext in LANGUAGE_EXTENSIONS
            }
            if detected_languages:
                detected_str = ", ".join(sorted(detected_languages))
                raise IngestionError(
                    f"No supported Python (.py) source files found in repository. CodeSentinel AI currently supports static analysis for Python only (detected: {detected_str}). Support for additional languages is planned."
                )
            else:
                raise IngestionError(
                    "No supported Python (.py) source files found in repository. CodeSentinel AI currently supports static analysis for Python only."
                )

        if py_files > config.MAX_FILES:
            raise IngestionError(
                f"Repository contains {py_files} Python files, exceeding the limit of {config.MAX_FILES} files."
            )

        return repo_root

    def ingest_local_directory(self, local_path_str: str) -> Path:
        """Validates and stages an authorized local directory for analysis."""
        is_valid, err_msg, resolved_path = validate_local_path(
            local_path_str=local_path_str,
            allowed_workspaces=config.ALLOWED_LOCAL_WORKSPACES,
            allow_local=config.ALLOW_LOCAL_ANALYSIS,
        )
        if not is_valid or resolved_path is None:
            raise IngestionError(err_msg or "Local directory validation failed.")

        return self._validate_extracted_repository(resolved_path)

    def cleanup_sandbox(self, path: Path) -> None:
        """Safely removes a temporary ingestion directory."""
        try:
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
