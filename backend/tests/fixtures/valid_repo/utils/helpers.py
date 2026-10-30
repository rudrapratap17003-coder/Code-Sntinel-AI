"""Helper utility module."""

def clean_string(s: str) -> str:
    if not s:
        return ""
    return s.strip().lower()
