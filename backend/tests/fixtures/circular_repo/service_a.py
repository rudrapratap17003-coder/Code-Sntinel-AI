"""Service A importing Service B."""

from service_b import process_b

def process_a(val):
    if val > 0:
        return process_b(val - 1)
    return 0
