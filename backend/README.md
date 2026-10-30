# CodeSentinel AI — Python Static Analysis Engine (Backend)

The Python Static Analysis Engine is the analytical foundation for CodeSentinel AI. It ingests Python repositories safely, performs multi-pass abstract syntax tree (AST) analysis, evaluates token duplication, extracts static import dependency graphs, computes cyclomatic complexity, and evaluates the Composite Maintenance Debt Index (CMDI).

---

## 1. Measurement Definitions & Methodology

### 1.1 Cyclomatic Complexity
* **Calculation:** Standard McCabe Cyclomatic Complexity ($M = E - N + 2P$). Each independent branch point increments complexity by 1:
  - Conditionals: `if`, `elif`, ternary `IfExp`
  - Loops: `for`, `async for`, `while`
  - Error catch branches: `except`
  - Context managers: `with`, `async with`
  - Assertions: `assert`
  - Boolean logical operators: each binary `and` / `or` in expressions
  - Comprehension filters: `[x for x in list if condition]`
  - Base complexity of any function or method is 1.
* **Tooling:** Implemented via Radon (`radon.complexity.cc_visit`) with a standalone pure AST fallback visitor.
* **Finding Conditions & Severity:**
  - `McCabe >= 25`: **Critical** (severe cognitive load, near-impossible to test all execution permutations).
  - `McCabe >= 15`: **High** (exceeds standard enterprise maintainability threshold).
  - `McCabe > 10`: **Medium** (approaching warning threshold).
* **Classification:** **MEASURED** (exact mathematical branch count).

### 1.2 Candidate Code Duplication
* **Detection Method:** Normalized token sliding-window hashing (Type-1 and Type-2 code clone detection):
  1. Source code is stripped of inline `#` comments and multiline triple-quoted docstrings.
  2. Formatting whitespace is normalized.
  3. A sliding window of $N = 10$ physical code lines is hashed using SHA-256.
  4. Matching hashes across different files or non-overlapping ranges of the same file are clustered and merged into contiguous duplicate spans.
* **Finding Conditions & Severity:**
  - Block size $\ge 40$ lines: **Critical**
  - Block size $\ge 25$ lines: **High**
  - Block size $\ge 10$ lines: **Medium**
* **Metrics:** Total duplicate lines and codebase duplication percentage ($DuplicateLines / TotalCodeLines \times 100$).
* **Classification:** **MEASURED** (exact normalized syntax matches).

### 1.3 Architectural Coupling
* **What Coupling Means:** Coupling evaluates static compile-time import relationships between Python modules within the repository.
  - **Afferent Coupling ($C_a$, in-degree):** The number of internal repository modules that import module $M$. High $C_a$ denotes a central, widely depended-upon component ("god-object" risk if unstable).
  - **Efferent Coupling ($C_e$, out-degree):** The number of internal modules that module $M$ imports.
  - **Instability Index ($I$):** $I = C_e / (C_a + C_e)$. $I = 0$ indicates a stable core module; $I = 1$ indicates a pure consumer leaf.
* **Circular Dependency Detection:** Implemented using Tarjan's Strongly Connected Components (SCC) algorithm. Any component with $\ge 2$ modules indicates a cyclic import loop ($A \to B \to A$ or $A \to B \to C \to A$).
* **Finding Conditions & Severity:**
  - Circular Dependency Loop: **Critical** (causes deferred runtime import initialization failures, prevents isolated testing, and creates garbage collection cycles).
  - High Afferent Coupling ($C_a \ge 12$): Flagged as high blast radius.
* **Classification:** **MEASURED** for static import presence; **HEURISTIC** for architectural blast radius interpretation.

### 1.4 Error-Handling Pattern Checks
* **Checked Patterns:**
  1. **Bare `except:` Clauses (`error-handling/bare-except`):** Intercepts `BaseException` subclasses such as `KeyboardInterrupt`, `SystemExit`, and `MemoryError`. **Severity: High**.
  2. **Catching BaseException (`error-handling/catch-base-exception`):** Masks process cancellation and container shutdown signals. **Severity: Medium**.
  3. **Empty Except Blocks (`error-handling/empty-catch`):** Discards caught exceptions with an empty `pass` or `...` statement with zero logging or re-raising. **Severity: Medium**.
  4. **Broad Exception Swallowing (`error-handling/broad-exception-swallow`):** Catches broad `Exception` with only early returns or continues, obscuring unexpected runtime tracebacks. **Severity: Medium**.
* **Classification:** **HEURISTIC** (AST syntax pattern detection). Pattern-based findings are described as maintainability risks and defensive anti-patterns rather than confirmed runtime defects.

### 1.5 Composite Maintenance Debt Index (CMDI)
* **Scale:** 0 to 100 (higher = greater maintainability concern).
* **Formula:** $CMDI = 0.25 \times R_{complexity} + 0.25 \times R_{duplication} + 0.25 \times R_{coupling} + 0.25 \times R_{error}$.
  - $R_{complexity}$: McCabe $\le 10 \to 0$; McCabe $\ge 40 \to 100$.
  - $R_{duplication}$: $0\% \to 0$; $\ge 25\% \to 100$.
  - $R_{coupling}$: $35 \times CircularCycles + \min(30, (MaxCa / 20) \times 30)$.
  - $R_{error}$: $100 - AdherenceScore$.
* **Tiers:**
  - `0–25`: Low Risk
  - `26–50`: Moderate Risk
  - `51–75`: High Risk
  - `76–100`: Critical Risk
* **Disclaimer:** CMDI is an internal CodeSentinel AI product heuristic, not a scientifically validated universal standard.

---

## 2. Repository Ingestion Security Model

To protect against untrusted repository code execution and server compromise:
1. **Zero Execution Policy:**
   - Code from analyzed repositories is **never** executed.
   - `setup.py`, `pip install`, `Makefile`, and build scripts are **never** invoked.
   - No external dependencies are installed from analyzed repositories.
2. **Network & URL Controls:**
   - Only secure HTTPS protocol (`https://`) is permitted.
   - Domain is restricted strictly to `github.com` and `www.github.com`.
   - Embedded credentials (`https://user:pass@...`) are rejected.
   - Non-routable and private IP ranges (e.g., `127.0.0.1`, `169.254.169.254`) are blocked.
3. **Archive Extraction & File Sandbox:**
   - **Zip Slip / Tar Traversal Guard:** Every archive member path is resolved and validated to ensure it stays strictly within the temporary extraction sandbox.
   - **Symlink Escape Protection:** Symlinks pointing outside repository boundaries or to absolute system paths are ignored or rejected.
   - **Size Limits:** Maximum archive download size is capped at 50 MB; streaming download aborts immediately if exceeded.
   - **File Limits:** Maximum 500 Python files analyzed per repository.
   - **File Size Cap:** Individual source files larger than 1 MB are skipped with diagnostic notices.
   - **Timeouts:** 20-second network download timeout; 60-second analysis execution timeout.

---

## 3. REST API Specification

### Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Diagnostic status, supported languages, and engine resource limits |
| `POST` | `/api/v1/analyze` | Initiates static analysis on a GitHub repository or local directory |
| `GET` | `/api/v1/analyses` | Lists historical analysis summaries from SQLite |
| `GET` | `/api/v1/analyses/{id}` | Retrieves full structured analysis report by ID |
| `DELETE` | `/api/v1/analyses/{id}` | Deletes an analysis record from SQLite |

### Example Analyze Request
```json
{
  "repository_url": "https://github.com/pallets/flask"
}
```

### Example Local Directory Request (for local/offline evaluation)
```json
{
  "local_path": "backend/tests/fixtures/valid_repo"
}
```

---

## 4. Running the Backend

### Start Server
From the project root:
```bash
backend\.venv\Scripts\uvicorn.exe app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
Interactive API documentation: `http://127.0.0.1:8000/docs`

### Run Backend Tests
```bash
backend\.venv\Scripts\pytest.exe backend/tests -v
```
