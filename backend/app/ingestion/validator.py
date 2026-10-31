"""GitHub Repository URL Validator & Local Workspace Security Validator."""

import os
import re
from pathlib import Path
from urllib.parse import urlparse
from typing import Tuple, Optional, List

from app import config


def is_path_within_workspace(target: Path, workspace: Path) -> bool:
    """Safely determines if target is strictly within or equal to workspace.

    Guarantees:
    - Canonical path resolution (eliminating symlinks and .. traversal)
    - Case-insensitive comparison on Windows
    - Segment-level containment (preventing prefix-confusion attacks)
    """
    try:
        res_target = target.resolve()
        res_workspace = workspace.resolve()

        norm_target_str = os.path.normcase(str(res_target))
        norm_workspace_str = os.path.normcase(str(res_workspace))

        p_target = Path(norm_target_str)
        p_workspace = Path(norm_workspace_str)

        return p_target.is_relative_to(p_workspace)
    except Exception:
        return False


def is_path_in_any_authorized_workspace(target: Path, authorized_workspaces: List[Path]) -> bool:
    """Checks whether target is inside any of the authorized workspace roots."""
    if not authorized_workspaces:
        return False
    return any(is_path_within_workspace(target, ws) for ws in authorized_workspaces)


def validate_local_path(
    local_path_str: str,
    allowed_workspaces: Optional[List[Path]] = None,
    allow_local: Optional[bool] = None,
) -> Tuple[bool, Optional[str], Optional[Path]]:
    """Validates local directory path for security and workspace boundary confinement.

    Returns:
        (is_valid: bool, error_message: Optional[str], resolved_path: Optional[Path])
    """
    effective_allow_local = (
        allow_local if allow_local is not None else getattr(config, "ALLOW_LOCAL_ANALYSIS", True)
    )
    if not effective_allow_local:
        return False, "Local directory analysis is disabled.", None

    if not local_path_str or not isinstance(local_path_str, str) or not local_path_str.strip():
        return False, "Local path is required. Please provide a valid directory path.", None

    try:
        resolved_path = Path(local_path_str.strip()).expanduser().resolve()
    except Exception:
        return False, "Invalid local path format.", None

    effective_workspaces = (
        allowed_workspaces if allowed_workspaces is not None else getattr(config, "ALLOWED_LOCAL_WORKSPACES", [])
    )

    # 1. Boundary containment check: must be inside an authorized workspace
    if not is_path_in_any_authorized_workspace(resolved_path, effective_workspaces):
        return False, "Access denied: Requested path is outside authorized workspace boundaries.", None

    # 2. Existence check
    if not resolved_path.exists():
        return False, "The requested local directory does not exist.", None

    # 3. Directory check
    if not resolved_path.is_dir():
        return False, "The requested local path is not a directory.", None

    return True, None, resolved_path


def validate_github_url(raw_url: str) -> Tuple[bool, Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Validates and normalizes a GitHub repository URL.
    
    Returns:
        (is_valid, error_message, normalized_url, owner, repo)
    """
    if not raw_url or not isinstance(raw_url, str) or not raw_url.strip():
        return False, "Repository URL is required. Please provide a valid GitHub URL.", None, None, None

    trimmed = raw_url.strip()

    # 1. Reject embedded inline credentials (user:pass@)
    if "@" in trimmed and not trimmed.startswith("git@"):
        return False, "Security Warning: URLs containing embedded user credentials (user:pass@) are disallowed.", None, None, None

    # 2. Enforce HTTPS protocol
    if not trimmed.startswith("https://"):
        if trimmed.startswith("http://"):
            return False, "Insecure Protocol: URL must use secure HTTPS (https://), not unencrypted HTTP.", None, None, None
        return False, "Invalid Format: URL must start with https://github.com/owner/repository.", None, None, None

    try:
        parsed = urlparse(trimmed)
    except Exception as e:
        return False, f"Malformed URL: Unable to parse the provided web address ({str(e)}).", None, None, None

    # 3. Domain validation
    hostname = (parsed.hostname or "").lower()
    if hostname not in ("github.com", "www.github.com"):
        return False, f"Unsupported Domain: CodeSentinel AI only accepts github.com repositories (received: {hostname}).", None, None, None

    # 4. Path validation & normalization
    clean_path = parsed.path.strip("/")
    segments = [s for s in clean_path.split("/") if s]

    if len(segments) < 2:
        return False, "Incomplete Path: URL must specify both an owner/organization and a repository name (e.g., https://github.com/owner/repository).", None, None, None

    owner = segments[0]
    repo = segments[1]

    # Strip optional .git suffix
    if repo.lower().endswith(".git"):
        repo = repo[:-4]

    # Reject non-alphanumeric/hyphen/underscore owner/repo names
    pattern = re.compile(r"^[a-zA-Z0-9_.-]+$")
    if not pattern.match(owner) or not pattern.match(repo):
        return False, "Invalid Characters: Owner and repository names may only contain alphanumeric characters, periods, hyphens, and underscores.", None, None, None

    # Reject path traversal tokens
    if ".." in owner or ".." in repo:
        return False, "Security Warning: Path traversal tokens (..) are prohibited in repository names.", None, None, None

    normalized_url = f"https://github.com/{owner}/{repo}"
    return True, None, normalized_url, owner, repo
