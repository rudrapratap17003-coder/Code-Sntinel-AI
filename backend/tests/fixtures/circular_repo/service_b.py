"""Service B importing Service A."""

from service_a import process_a

def process_b(val):
    if val > 0:
        return process_a(val - 1)
    return 0
