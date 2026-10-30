"""Formatter module importing math operations."""

from core.math_ops import add, multiply

def format_calculation(a: int, b: int) -> str:
    sum_val = add(a, b)
    prod_val = multiply(a, b)
    return f"Sum: {sum_val}, Product: {prod_val}"
