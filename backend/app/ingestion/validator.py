"""GitHub Repository URL Validator & Normalizer."""

import re
from urllib.parse import urlparse
from typing import Tuple, Optional


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
