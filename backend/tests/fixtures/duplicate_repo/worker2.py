"""Worker 2."""

def transform_records_beta(records):
    # Common duplicate block of 12 lines
    sanitized = []
    for item in records:
        if not item:
            continue
        key = item.get("id")
        name = item.get("name", "Unknown")
        status = item.get("status", "pending")
        if status == "active":
            sanitized.append({"key": key, "name": name, "state": "ready"})
        elif status == "disabled":
            sanitized.append({"key": key, "name": name, "state": "inactive"})
    return sanitized
