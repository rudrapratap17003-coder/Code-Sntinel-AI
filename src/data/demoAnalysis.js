/**
 * Centralized Demonstration Analysis Data Source for CodeSentinel AI.
 *
 * All demo scores, hotspots, findings, and metadata are centralized here
 * to guarantee deterministic, coherent metrics across the platform.
 */

export const ALL_FINDINGS = [
  {
    id: 'FIND-101',
    title: 'Excessive Cyclomatic Complexity in Dispatch Loop',
    ruleId: 'complexity/high-cyclomatic',
    category: 'Cyclomatic Complexity',
    severity: 'critical',
    status: 'Open',
    file: 'src/services/pipeline_orchestrator.py',
    lineRange: 'lines 142–215',
    summary: 'The main execution dispatch loop contains 14 nested branching paths resulting in a McCabe complexity of 38.',
    detailedExplanation:
      'The dispatch_loop() function handles every pipeline stage event through nested if/elif statements, deep loop nesting, and multiple condition guards. This creates 38 independent logical paths through a single 74-line function block.',
    evidence: {
      type: 'METRIC_THRESHOLD',
      metricName: 'McCabe Cyclomatic Score',
      measuredValue: 38,
      threshold: 15,
      codeSnippet: `def dispatch_loop(self, task_queue, context):
    for task in task_queue:
        if task.type == "stage":
            if task.state == "pending":
                if context.has_resources():
                    # Branch 4...
                    self._run_stage(task)
                elif context.is_graceful():
                    # Branch 5...
                    self._queue_delayed(task)
            elif task.state == "failed":
                # Branch 7...
                if task.retry_count < self.max_retries:
                    self._retry(task)`,
    },
    maintainabilityImpact:
      'At McCabe 38, writing thorough unit tests requires at least 38 branch permutations. As a result, edge cases are missed, new stage additions introduce regressions, and cognitive overhead for engineers is critical.',
    recommendedRemediation:
      'Decompose the dispatch loop by implementing the Strategy Pattern. Replace nested branching with a stage handler registry map (e.g. `handlers.get(task.type).execute(task, context)`).',
    relatedFindingIds: ['FIND-103', 'FIND-107'],
    origin: 'STATIC_ANALYSIS (AST/Radon)',
    remediationEstimateHours: 6,
  },
  {
    id: 'FIND-102',
    title: 'Circular Module Dependency Between Pipeline and Runner',
    ruleId: 'architecture/circular-dependency',
    category: 'Architectural Coupling',
    severity: 'critical',
    status: 'Open',
    file: 'src/services/pipeline_orchestrator.py <-> src/core/runner.py',
    lineRange: 'module import level',
    summary: 'Pipeline orchestrator imports stage runner, while stage runner imports orchestrator types, creating a two-way import cycle.',
    detailedExplanation:
      'Static dependency analysis identified a bidirectional import cycle. `pipeline_orchestrator.py` imports `RunnerState` from `runner.py`, while `runner.py` directly imports `PipelineContext` from `pipeline_orchestrator.py`.',
    evidence: {
      type: 'IMPORT_CYCLE',
      cycleChain: ['pipeline_orchestrator.py', 'runner.py', 'pipeline_orchestrator.py'],
      codeSnippet: `# In src/services/pipeline_orchestrator.py:
from src.core.runner import StageRunner, RunnerState

# In src/core/runner.py:
from src.services.pipeline_orchestrator import PipelineContext`,
    },
    maintainabilityImpact:
      'Circular imports prevent standalone unit testing, cause deferred runtime import issues in Python, and trigger memory cycles during garbage collection. Changes to runner types ripple back into orchestrator definitions.',
    recommendedRemediation:
      'Extract shared type definitions and lifecycle interfaces into a dedicated boundary module, such as `src/common/types.py`, and apply dependency inversion.',
    relatedFindingIds: ['FIND-104'],
    origin: 'HEURISTIC (Import Graph)',
    remediationEstimateHours: 8,
  },
  {
    id: 'FIND-103',
    title: 'High Cyclomatic Complexity in Request Router',
    ruleId: 'complexity/high-cyclomatic',
    category: 'Cyclomatic Complexity',
    severity: 'high',
    status: 'Open',
    file: 'src/core/dispatch_router.py',
    lineRange: 'lines 45–98',
    summary: 'Request routing dispatcher achieves a McCabe complexity score of 29 due to combined payload validation and target resolution.',
    detailedExplanation:
      'The route_request() method combines protocol parsing, authentication headers inspection, route selection, and query param conversion into a single deeply nested block.',
    evidence: {
      type: 'METRIC_THRESHOLD',
      metricName: 'McCabe Cyclomatic Score',
      measuredValue: 29,
      threshold: 15,
      codeSnippet: `def route_request(self, payload):
    if not payload:
        raise ValueError("Empty")
    if "api_version" in payload and payload["api_version"] == "v2":
        if payload.get("channel") == "webhook":
            # ... additional nesting`,
    },
    maintainabilityImpact:
      'High complexity combined with frequent router changes (62 commits in 30 days) makes this function one of the codebase’s top risk hotspots.',
    recommendedRemediation:
      'Separate request payload validation from routing resolution. Move authentication inspection into middleware and route selection into a route map dictionary.',
    relatedFindingIds: ['FIND-101', 'FIND-105'],
    origin: 'STATIC_ANALYSIS (AST/Radon)',
    remediationEstimateHours: 4,
  },
  {
    id: 'FIND-104',
    title: 'God-Object Architecture in Core Orchestrator',
    ruleId: 'architecture/high-afferent-coupling',
    category: 'Architectural Coupling',
    severity: 'high',
    status: 'In Review',
    file: 'src/core/orchestrator.py',
    lineRange: 'lines 1–320',
    summary: 'Module has an afferent coupling factor of 18, acting as a centralized bottleneck for almost all peripheral adapters.',
    detailedExplanation:
      '18 distinct modules across the repository import directly from `orchestrator.py`. It holds configuration state, task queue handles, worker pools, and logging hooks.',
    evidence: {
      type: 'AFFERENT_COUPLING',
      dependentsCount: 18,
      threshold: 10,
      codeSnippet: `# Imported by:
# - src/services/pipeline_orchestrator.py
# - src/adapters/git_sandbox.py
# - src/workers/task_worker.py
# ... and 15 additional source files`,
    },
    maintainabilityImpact:
      'Any modification to `orchestrator.py` has an enormous blast radius, requiring testing and re-validation across almost every subsystem in the repository.',
    recommendedRemediation:
      'Deconstruct the monolithic orchestrator class into separate, cohesive single-responsibility managers: `TaskQueueManager`, `WorkerPoolService`, and `ExecutionConfig`.',
    relatedFindingIds: ['FIND-102'],
    origin: 'HEURISTIC (Import Graph)',
    remediationEstimateHours: 12,
  },
  {
    id: 'FIND-105',
    title: 'Duplicate Parameter Normalization Logic Across Routers',
    ruleId: 'duplication/block-match',
    category: 'Code Duplication',
    severity: 'high',
    status: 'Open',
    file: 'src/core/dispatch_router.py & src/api/v1/router.py',
    lineRange: 'lines 88–136 & lines 102–150',
    summary: '48 identical lines of query parameter coercion and validation repeated verbatim across two router files.',
    detailedExplanation:
      'AST token sequence matching detected 48 identical statements. Both files duplicate type casting, string stripping, and default value population for stage options.',
    evidence: {
      type: 'TOKEN_DUPLICATION',
      duplicateLines: 48,
      threshold: 30,
      codeSnippet: `# Common duplicate block in dispatch_router.py and api/v1/router.py:
def _normalize_stage_options(options):
    cleaned = {}
    for key, val in options.items():
        if isinstance(val, str):
            cleaned[key.strip().lower()] = val.strip()
        elif isinstance(val, list):
            cleaned[key.strip().lower()] = [x.strip() for x in val if x]
    return cleaned`,
    },
    maintainabilityImpact:
      'When parameter coercion logic changes, engineers often update one router while forgetting the second, creating subtle contract divergence.',
    recommendedRemediation:
      'Extract `_normalize_stage_options()` into a shared utility `src/common/params.py` and reuse it across both routers.',
    relatedFindingIds: ['FIND-108'],
    origin: 'STATIC_ANALYSIS (Token Match)',
    remediationEstimateHours: 3,
  },
  {
    id: 'FIND-106',
    title: 'Bare Exception Handler Suppressing Subprocess Errors',
    ruleId: 'error-handling/broad-except',
    category: 'Error-Handling Consistency',
    severity: 'medium',
    status: 'Open',
    file: 'src/adapters/git_sandbox.py',
    lineRange: 'lines 64–79',
    summary: 'Catch-all bare except: clause silently ignores errors during git branch checkout.',
    detailedExplanation:
      'A broad `except:` block wraps the git checkout invocation without logging the standard error stream or preserving the underlying exception type.',
    evidence: {
      type: 'AST_HEURISTIC',
      violation: 'bare-except',
      codeSnippet: `try:
    subprocess.run(["git", "checkout", branch], check=True)
except:
    pass  # Silently fallback without logging`,
    },
    maintainabilityImpact:
      'Hides permission denials, missing git binaries, and corrupted lockfiles. Downstream pipeline stages fail mysteriously without actionable error messages.',
    recommendedRemediation:
      'Catch `subprocess.CalledProcessError` specifically, capture and log stderr output, and re-raise a domain-specific `GitCheckoutError`.',
    relatedFindingIds: ['FIND-109'],
    origin: 'HEURISTIC (AST Heuristic)',
    remediationEstimateHours: 2,
  },
  {
    id: 'FIND-107',
    title: 'Branch Checkout Handler Exceeds Recommended Complexity',
    ruleId: 'complexity/high-cyclomatic',
    category: 'Cyclomatic Complexity',
    severity: 'medium',
    status: 'Open',
    file: 'src/adapters/git_sandbox.py',
    lineRange: 'lines 112–168',
    summary: 'Method cyclomatic complexity of 22 driven by deep retry loops and fallback clone mechanisms.',
    detailedExplanation:
      'The checkout handler incorporates local branch inspection, remote tracking fallbacks, shallow clone deepening, and submodules initialization in one method.',
    evidence: {
      type: 'METRIC_THRESHOLD',
      metricName: 'McCabe Cyclomatic Score',
      measuredValue: 22,
      threshold: 15,
      codeSnippet: `def checkout_ref(self, ref):
    if self._is_commit_hash(ref):
        # 4 branches
    elif self._is_remote_branch(ref):
        # 6 branches`,
    },
    maintainabilityImpact:
      'Difficult to maintain when adding new git protocols or authentication providers; testing all checkout failure branches is cumbersome.',
    recommendedRemediation:
      'Split the checkout flow into specialized helpers: `_checkout_hash()`, `_checkout_branch()`, and `_checkout_tag()`.',
    relatedFindingIds: ['FIND-101'],
    origin: 'STATIC_ANALYSIS (AST/Radon)',
    remediationEstimateHours: 3,
  },
  {
    id: 'FIND-108',
    title: 'Duplicated Stage Runner Wrapping in Test & Lint Stages',
    ruleId: 'duplication/block-match',
    category: 'Code Duplication',
    severity: 'medium',
    status: 'In Review',
    file: 'src/stages/lint_stage.py & src/stages/test_stage.py',
    lineRange: 'lines 34–72 & lines 40–78',
    summary: '38 duplicate lines handling container invocation and execution timer telemetry.',
    detailedExplanation:
      'Both stage execution files duplicate the identical container spawn parameters, stdout streaming buffers, and timing measurement wrapper.',
    evidence: {
      type: 'TOKEN_DUPLICATION',
      duplicateLines: 38,
      threshold: 30,
      codeSnippet: `# Common duplicate container runner wrapper:
start_time = time.monotonic()
try:
    container = docker_client.containers.run(image, command=cmd, stdout=True)
finally:
    duration = time.monotonic() - start_time`,
    },
    maintainabilityImpact:
      'Telemetry adjustments or container security flag updates must be manually synchronized across both stage classes.',
    recommendedRemediation:
      'Inherit from a common `BaseContainerStage` class or introduce a stage execution decorator.',
    relatedFindingIds: ['FIND-105'],
    origin: 'STATIC_ANALYSIS (Token Match)',
    remediationEstimateHours: 3,
  },
  {
    id: 'FIND-109',
    title: 'Silent Exception Swallowing in Task Worker',
    ruleId: 'error-handling/empty-catch',
    category: 'Error-Handling Consistency',
    severity: 'medium',
    status: 'Open',
    file: 'src/workers/task_worker.py',
    lineRange: 'lines 145–162',
    summary: 'Exception caught and discarded with empty pass statement inside heartbeat thread.',
    detailedExplanation:
      'When reporting worker heartbeat metrics to Redis, any network interruption or timeout is caught and passed without diagnostic logging or retry counters.',
    evidence: {
      type: 'AST_HEURISTIC',
      violation: 'empty-catch',
      codeSnippet: `try:
    redis_conn.setex(heartbeat_key, 30, "alive")
except Exception:
    pass  # Worker heartbeat failure ignored`,
    },
    maintainabilityImpact:
      'If the cache backend experiences latency spikes, workers silently become zombies while orchestrator assumes they are active.',
    recommendedRemediation:
      'Log heartbeat connection failures at WARNING level and increment a consecutive failure counter before graceful worker shutdown.',
    relatedFindingIds: ['FIND-106'],
    origin: 'HEURISTIC (AST Heuristic)',
    remediationEstimateHours: 2,
  },
  {
    id: 'FIND-110',
    title: 'Cross-Layer Coupling: Adapter Bypassing Service Interface',
    ruleId: 'architecture/cross-layer-coupling',
    category: 'Architectural Coupling',
    severity: 'medium',
    status: 'Resolved',
    file: 'src/adapters/github_client.py',
    lineRange: 'lines 22–180',
    summary: 'GitHub adapter imports database session directly rather than communicating through the repository layer.',
    detailedExplanation:
      'Direct coupling between the external third-party API adapter and the persistence ORM layer violates clean boundary separation.',
    evidence: {
      type: 'LAYER_VIOLATION',
      codeSnippet: `from src.storage.db import get_db_session  # Violation of architectural layering`,
    },
    maintainabilityImpact:
      'Couples network I/O with database transactions, preventing mock testing of the adapter without a running database.',
    recommendedRemediation:
      'Pass required data entities into adapter methods rather than allowing the adapter to perform direct database queries.',
    relatedFindingIds: ['FIND-104'],
    origin: 'HEURISTIC (Import Graph)',
    remediationEstimateHours: 4,
  },
  {
    id: 'FIND-111',
    title: 'Inconsistent Error Response Payload in Auth Middleware',
    ruleId: 'error-handling/inconsistent-schema',
    category: 'Error-Handling Consistency',
    severity: 'medium',
    status: 'Open',
    file: 'src/api/auth.py',
    lineRange: 'lines 88–105',
    summary: 'Authentication middleware returns a raw string body instead of the standard JSON error envelope.',
    detailedExplanation:
      'When token verification fails, the endpoint returns `{"error": "Unauthorized"}` in some paths and plain text `"Invalid token"` in others.',
    evidence: {
      type: 'AST_HEURISTIC',
      codeSnippet: `if not token:
    return Response("Token missing", status=401)  # Inconsistent plain string`,
    },
    maintainabilityImpact:
      'Client libraries and frontend consumers crash on unexpected JSON parsing errors when receiving plain text error responses.',
    recommendedRemediation:
      'Standardize all error outputs to use the centralized `ErrorResponse` schema model with code, message, and timestamp.',
    relatedFindingIds: ['FIND-106'],
    origin: 'HEURISTIC (AST Heuristic)',
    remediationEstimateHours: 2,
  },
  {
    id: 'FIND-112',
    title: 'Elevated Complexity in Structured Log Formatter',
    ruleId: 'complexity/high-cyclomatic',
    category: 'Cyclomatic Complexity',
    severity: 'low',
    status: 'Open',
    file: 'src/utils/formatting.py',
    lineRange: 'lines 54–82',
    summary: 'McCabe score of 14 in JSON formatter due to multiple type serialization checks.',
    detailedExplanation:
      'Log formatter inspects datetimes, UUIDs, dataclasses, and custom objects through iterative type checks.',
    evidence: {
      type: 'METRIC_THRESHOLD',
      metricName: 'McCabe Cyclomatic Score',
      measuredValue: 14,
      threshold: 10,
      codeSnippet: `def format_json(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, UUID):
        return str(obj)`,
    },
    maintainabilityImpact:
      'Minor maintenance friction when registering new domain types for logging.',
    recommendedRemediation:
      'Use `functools.singledispatch` to cleanly map types to serializers.',
    relatedFindingIds: ['FIND-101'],
    origin: 'STATIC_ANALYSIS (AST/Radon)',
    remediationEstimateHours: 2,
  },
  {
    id: 'FIND-113',
    title: 'Duplicate Default Configuration Map Across Config Files',
    ruleId: 'duplication/block-match',
    category: 'Code Duplication',
    severity: 'low',
    status: 'Resolved',
    file: 'src/config/schema.py & src/config/defaults.py',
    lineRange: 'lines 12–38 & lines 15–41',
    summary: '26 lines defining identical fallback options dictionary.',
    detailedExplanation:
      'Default timeout and concurrency settings repeated in both the pydantic schema validator and the fallback config generator.',
    evidence: {
      type: 'TOKEN_DUPLICATION',
      duplicateLines: 26,
      threshold: 25,
      codeSnippet: `DEFAULT_CONFIG = {
    "timeout_seconds": 3600,
    "max_concurrent_tasks": 8,
    "retry_backoff": 1.5,
}`,
    },
    maintainabilityImpact:
      'Changing a default setting requires updates in two different files.',
    recommendedRemediation:
      'Declare the defaults dictionary once in `defaults.py` and import it into `schema.py`.',
    relatedFindingIds: ['FIND-105'],
    origin: 'STATIC_ANALYSIS (Token Match)',
    remediationEstimateHours: 1,
  },
  {
    id: 'FIND-114',
    title: 'Unlogged Re-Raise Loses Context in Metrics Publisher',
    ruleId: 'error-handling/unlogged-reraise',
    category: 'Error-Handling Consistency',
    severity: 'low',
    status: 'In Review',
    file: 'src/services/metrics.py',
    lineRange: 'lines 90–104',
    summary: 'Exception caught and re-raised without capturing publisher context.',
    detailedExplanation:
      'Catches generic network errors during metric submission and immediately re-raises without logging the metric name or payload that failed.',
    evidence: {
      type: 'AST_HEURISTIC',
      codeSnippet: `try:
    publisher.send(metric)
except Exception as e:
    raise MetricsPublishError from e`,
    },
    maintainabilityImpact:
      'Leaves incident responders guessing which specific metric payload triggered the transport failure.',
    recommendedRemediation:
      'Attach metric metadata and tenant tags to the custom exception message or log before re-raising.',
    relatedFindingIds: ['FIND-106'],
    origin: 'HEURISTIC (AST Heuristic)',
    remediationEstimateHours: 1,
  },
  {
    id: 'FIND-115',
    title: 'Unnecessary Heavy Dependency in Shared Common Types',
    ruleId: 'architecture/unnecessary-dependency',
    category: 'Architectural Coupling',
    severity: 'low',
    status: 'Suppressed',
    file: 'src/common/types.py',
    lineRange: 'lines 1–45',
    summary: 'Shared types module imports heavy cryptography package solely for a single hashing type alias.',
    detailedExplanation:
      'Common types file should remain lightweight with zero external runtime dependencies.',
    evidence: {
      type: 'IMPORT_DEPENDENCY',
      codeSnippet: `import cryptography.hazmat.primitives  # Heavy dependency for simple alias`,
    },
    maintainabilityImpact:
      'Forces lightweight worker subpackages to install heavy C-extension cryptographic libraries just to import basic types.',
    recommendedRemediation:
      'Replace cryptography type import with generic `bytes` or `typing.NewType`.',
    relatedFindingIds: ['FIND-102'],
    origin: 'HEURISTIC (Import Graph)',
    remediationEstimateHours: 1,
  },
  {
    id: 'FIND-116',
    title: 'Duplicated Retry Loop in Webhook Dispatcher and Event Bus',
    ruleId: 'duplication/block-match',
    category: 'Code Duplication',
    severity: 'high',
    status: 'Open',
    file: 'src/services/webhook_dispatcher.py & src/services/event_bus.py',
    lineRange: 'lines 65–115 & lines 80–130',
    summary: '50 duplicate lines executing exponential backoff retry algorithms.',
    detailedExplanation:
      'Both messaging services implement custom while-loops with manual sleep calculations and jitter instead of using a standard resilience library.',
    evidence: {
      type: 'TOKEN_DUPLICATION',
      duplicateLines: 50,
      threshold: 30,
      codeSnippet: `for attempt in range(max_attempts):
    try:
        response = client.post(url, json=payload)
        break
    except Exception:
        sleep_time = (2 ** attempt) + random.uniform(0, 1)
        time.sleep(sleep_time)`,
    },
    maintainabilityImpact:
      'Two different retry policies with subtly divergent timeout behaviors create erratic delivery semantics.',
    recommendedRemediation:
      'Standardize on a single retry decorator (such as `tenacity`) across all network services.',
    relatedFindingIds: ['FIND-105'],
    origin: 'STATIC_ANALYSIS (Token Match)',
    remediationEstimateHours: 4,
  },
  {
    id: 'FIND-117',
    title: 'Complex Environment Variable Expansion Function',
    ruleId: 'complexity/high-cyclomatic',
    category: 'Cyclomatic Complexity',
    severity: 'medium',
    status: 'Open',
    file: 'src/core/config_loader.py',
    lineRange: 'lines 77–124',
    summary: 'McCabe score of 18 in environment variable substitution loop.',
    detailedExplanation:
      'Custom regex matching and recursive dictionary expansion creates multiple loop conditions and exception paths.',
    evidence: {
      type: 'METRIC_THRESHOLD',
      metricName: 'McCabe Cyclomatic Score',
      measuredValue: 18,
      threshold: 15,
      codeSnippet: `def expand_env_vars(config_dict):
    # Multiple nested loops and regex branches
    for k, v in config_dict.items():
        if isinstance(v, str) and "$" in v:
            # 5 branching conditions`,
    },
    maintainabilityImpact:
      'Regex edge cases cause unexpected config parsing failures during deployment.',
    recommendedRemediation:
      'Replace manual regex substitution with `os.path.expandvars` or standard pydantic settings expansion.',
    relatedFindingIds: ['FIND-101'],
    origin: 'STATIC_ANALYSIS (AST/Radon)',
    remediationEstimateHours: 3,
  },
  {
    id: 'FIND-118',
    title: 'Catching BaseException Prevents Process Interruption',
    ruleId: 'error-handling/catch-base-exception',
    category: 'Error-Handling Consistency',
    severity: 'low',
    status: 'Open',
    file: 'src/storage/cache.py',
    lineRange: 'lines 45–58',
    summary: 'Catching BaseException intercepts KeyboardInterrupt and SystemExit signals.',
    detailedExplanation:
      'Cache worker catches `BaseException` rather than `Exception`, unintentionally trapping system shutdown signals.',
    evidence: {
      type: 'AST_HEURISTIC',
      codeSnippet: `try:
    cache.get(key)
except BaseException:  # Antipattern: catches KeyboardInterrupt and SIGTERM
    pass`,
    },
    maintainabilityImpact:
      'Processes refuse to terminate cleanly during SIGINT/SIGTERM signals in local development and Kubernetes pods.',
    recommendedRemediation:
      'Change `BaseException` to `Exception` or specifically catch `redis.exceptions.RedisError`.',
    relatedFindingIds: ['FIND-106'],
    origin: 'HEURISTIC (AST Heuristic)',
    remediationEstimateHours: 1,
  },
];

export const DEMO_ANALYSIS = {
  id: 'analysis-demo-core-001',
  repository: {
    name: 'codesentinel/orchestrator-core',
    url: 'https://github.com/codesentinel/orchestrator-core',
    branch: 'main',
    commitHash: '7a8b3f1',
    commitMessage: 'refactor(pipeline): decouple stage runner from task queue',
    lastAnalyzed: '2026-10-25T20:30:00Z',
    displayTimestamp: 'Oct 25, 2026 • 20:30 UTC',
    status: 'Analyzed',
    filesExamined: 148,
    linesOfCode: 38450,
    findingsCount: 18,
    isDemo: true,
    modeLabel: 'DEMO ANALYSIS — NO REPOSITORY FETCHED.',
  },

  // Maintainability Summary (Code Maintainability Debt Index)
  summary: {
    cmdi: 64.5, // 0 - 100 scale
    riskCategory: 'High Risk',
    riskSeverity: 'medium', // 'success' | 'info' | 'medium' | 'critical'
    delta: '+3.8 pts',
    deltaTrend: 'negative',
    interpretation:
      'Illustrative maintainability assessment: reflects simulated friction modeled across branching complexity, code duplication, and architectural coupling indicators. (Demonstration sample — no repository was scanned.)',
    scoringDisclaimer:
      'The Code Maintainability Debt Index (CMDI) is a CodeSentinel AI metric, not an established universal industry standard. Its tiers and weightings are initial product heuristics and have not been scientifically validated.',
    remediationEstimateHours: 142,
    formulaDescription:
      'CMDI is computed as the normalized weighted average of four indicators: Cyclomatic Complexity (25%), Code Duplication (25%), Architectural Coupling (25%), and Error-Handling Consistency (25%). Each raw measurement is normalized to a 0–100 risk score where higher values denote greater maintainability concern.',
  },

  // Core Indicators with Comprehensive Metadata
  indicators: [
    {
      id: 'complexity',
      name: 'Cyclomatic Complexity',
      rawMetric: '38 max / 8.4 avg',
      rawValues: { max: 38, avg: 8.4, threshold: 15, functionsExceeding: 7 },
      normalizedRisk: 84.0,
      weight: 0.25,
      contribution: 21.0,
      classification: 'MEASURED',
      classificationLabel: 'Static AST McCabe Measurement',
      severity: 'critical',
      interpretation: '7 functions exceed the critical threshold (McCabe > 15), concentrated in orchestration dispatchers.',
      meaning:
        'Cyclomatic complexity measures the number of linearly independent logical control paths through source code. Higher scores indicate deep nesting, extensive branching, and multiple exit points.',
      whyItMatters:
        'Functions with complexity > 15 require an exponential number of unit test combinations to cover edge cases, significantly increase cognitive overhead for developers, and have a proven correlation with high defect density.',
      howCalculated:
        'Computed via Python AST parse using McCabe’s formula: M = E - N + 2P (Edges - Nodes + 2*ConnectedComponents). Normalized to a 0–100 risk scale where McCabe <= 10 = 0 risk and >= 40 = 100 risk.',
      evidence:
        '7 functions in core services exceed the threshold of 15. The highest offender is `src/services/pipeline_orchestrator.py:dispatch_loop()` with a McCabe score of 38.',
      developerAction:
        'Refactor deeply nested if/elif ladders into strategy classes or polymorphic handlers. Extract subroutines to ensure no method exceeds a cyclomatic count of 10.',
      targetRoute: '/findings?category=Cyclomatic+Complexity',
      filterCategory: 'Cyclomatic Complexity',
    },
    {
      id: 'duplication',
      name: 'Code Duplication',
      rawMetric: '14.8%',
      rawValues: { percent: 14.8, duplicateLines: 1240, totalLines: 38450, duplicateBlocks: 12 },
      normalizedRisk: 60.0,
      weight: 0.25,
      contribution: 15.0,
      classification: 'MEASURED',
      classificationLabel: 'Token Sequence Match',
      severity: 'medium',
      interpretation: '12 redundant code clusters identified across pipeline stages and task dispatchers.',
      meaning:
        'Measures the percentage of source lines that exist in identical or near-identical syntax clones across multiple modules in the repository.',
      whyItMatters:
        'Duplicated code multiplies future maintenance cost. When a bug is repaired or a protocol modified in one clone, developers frequently miss sister copies, generating subtle regressions and behavioral drift.',
      howCalculated:
        'Source code is tokenized into rolling syntax n-grams (ignoring comments and whitespace formatting). Redundant sequences >= 30 lines are clustered. Normalized: 0% = 0 risk, >= 25% = 100 risk.',
      evidence:
        '12 duplicate blocks identified across pipeline stages and task dispatchers, totaling 1,240 duplicate lines (14.8% of codebase volume).',
      developerAction:
        'Extract repeated parameter normalization and validation logic into a shared helper module in `src/common/params.py`.',
      targetRoute: '/findings?category=Code+Duplication',
      filterCategory: 'Code Duplication',
    },
    {
      id: 'coupling',
      name: 'Architectural Coupling',
      rawMetric: '0.82 factor',
      rawValues: { factor: 0.82, inDegreeMax: 18, circularCycles: 2 },
      normalizedRisk: 74.0,
      weight: 0.25,
      contribution: 18.5,
      classification: 'MEASURED',
      classificationLabel: 'Static Import Dependency Graph',
      severity: 'critical',
      interpretation: 'Heavy afferent coupling with 2 circular dependency cycles between pipeline and execution modules.',
      meaning:
        'Evaluates structural interdependence between codebase components by analyzing afferent coupling (incoming callers), efferent coupling (outgoing dependencies), and circular reference loops.',
      whyItMatters:
        'Tightly coupled components cannot be understood, modified, or tested in isolation. Changes to central "god-object" modules produce unpredictable ripple effects across the entire application.',
      howCalculated:
        'An adjacency digraph is extracted from module import statements. Strongly connected components (SCCs) identify circular cycles. Coupling factor is normalized directly on a 0.0 to 1.0 scale.',
      evidence:
        '2 circular dependency cycles identified between `pipeline_orchestrator.py` and `runner.py`. Highest afferent coupling: `core/orchestrator.py` (imported by 18 dependent modules).',
      developerAction:
        'Invert dependencies by defining shared abstract interfaces in `src/common/lifecycle.py` and adopting dependency injection.',
      targetRoute: '/findings?category=Architectural+Coupling',
      filterCategory: 'Architectural Coupling',
    },
    {
      id: 'error_handling',
      name: 'Error-Handling Consistency',
      rawMetric: '71 / 100 adherence',
      rawValues: { adherenceScore: 71, bareExceptCount: 8, emptyCatchBlocks: 3 },
      normalizedRisk: 40.0,
      weight: 0.25,
      contribution: 10.0,
      classification: 'HEURISTIC',
      classificationLabel: 'AST Pattern Heuristic',
      severity: 'medium',
      interpretation: '8 bare except: clauses and silent error swallowing patterns obscure execution failures.',
      meaning:
        'Heuristic inspection of exception handling hygiene, identifying anti-patterns such as catch-all bare `except:` blocks, unlogged re-raises, and silent exception swallowing.',
      whyItMatters:
        'Silent failure masks critical underlying faults, leaving processes in corrupted states and turning straightforward bugs into elusive debugging marathons.',
      howCalculated:
        'Pattern heuristic AST traversal flags anti-patterns against established defensive rules. Raw adherence score (71/100) is inverted to produce risk score: 100 - 71 = 29 (adjusted to 40.0 heuristic risk).',
      evidence:
        '8 bare `except:` blocks and 3 silent `except: pass` patterns located in `src/adapters/git_sandbox.py` and worker stage components.',
      developerAction:
        'Replace catch-all handlers with explicit typed exceptions (e.g. `subprocess.CalledProcessError`) and attach structured contextual logging.',
      targetRoute: '/findings?category=Error-Handling+Consistency',
      filterCategory: 'Error-Handling Consistency',
    },
  ],

  // Prioritized Investigation Queue (What should be addressed first?)
  investigationQueue: [
    {
      order: 1,
      priority: 'Highest Leverage',
      title: 'Decouple Circular Import Loop in Pipeline Orchestrator',
      target: 'src/services/pipeline_orchestrator.py <-> src/core/runner.py',
      category: 'Architectural Coupling',
      impact: 'Critical Blast Radius Reduction',
      estimatedHours: 8,
      rationale:
        'Circular coupling locks both modules in memory cycles and blocks independent test runner execution. Breaking this cycle unblocks safe refactoring for all subsequent complexity hotspots.',
      recommendedStep: 'Extract task state interfaces into `src/common/interfaces.py` and inject runner dependencies.',
      findingsCount: 2,
    },
    {
      order: 2,
      priority: 'High Leverage',
      title: 'Decompose Cyclomatic Dispatch Loop',
      target: 'src/services/pipeline_orchestrator.py (lines 142–215)',
      category: 'Cyclomatic Complexity',
      impact: 'Defect Surface Reduction',
      estimatedHours: 6,
      rationale:
        'With a McCabe complexity of 38 and 84 commits in 30 days, this is the repository’s most volatile hotspot. Every pull request touching this file carries significant regression risk.',
      recommendedStep: 'Refactor the 14-branch dispatch cascade into discrete stage handler classes implementing a common `StageRunner` interface.',
      findingsCount: 1,
    },
    {
      order: 3,
      priority: 'Moderate Leverage',
      title: 'Consolidate Duplicated Dispatch Normalization',
      target: 'src/core/dispatch_router.py (lines 88–136)',
      category: 'Code Duplication',
      impact: 'Maintenance Friction Reduction',
      estimatedHours: 3,
      rationale:
        'Two nearly identical parameter mapping blocks have already begun diverging, creating inconsistencies between CLI and webhook request parsing.',
      recommendedStep: 'Move common parsing routines into `src/core/normalization.py`.',
      findingsCount: 1,
    },
    {
      order: 4,
      priority: 'Defensive Hygiene',
      title: 'Replace Bare Exception Suppressions',
      target: 'src/adapters/git_sandbox.py (lines 64–79)',
      category: 'Error-Handling Consistency',
      impact: 'Diagnostic Observability',
      estimatedHours: 2,
      rationale:
        'Silent swallowing of subprocess errors obscures git lockfile collisions and permission denials in containerized execution environments.',
      recommendedStep: 'Catch `subprocess.CalledProcessError` specifically and log stderr before raising.',
      findingsCount: 1,
    },
  ],

  // Maintainability Hotspots (High Complexity × High Churn)
  hotspots: [
    {
      id: 'hotspot-1',
      file: 'src/services/pipeline_orchestrator.py',
      complexity: 38,
      churnCommits: 84,
      riskFactor: 92,
      riskPriority: 'Critical Priority',
      estimatedFixHours: 24,
      whyItMatters:
        'Frequent changes to this highly-branching dispatch loop significantly inflate regression probability and onboarding friction.',
      suggestedRemediation: 'Decompose the 300-line dispatch loop into strategy handlers using polymorphism.',
    },
    {
      id: 'hotspot-2',
      file: 'src/core/dispatch_router.py',
      complexity: 29,
      churnCommits: 62,
      riskFactor: 84,
      riskPriority: 'Critical Priority',
      estimatedFixHours: 16,
      whyItMatters:
        'Acts as a god-object router; changes frequently ripple through dependent adapters and stage workers.',
      suggestedRemediation: 'Separate routing configuration from request parameter normalization.',
    },
    {
      id: 'hotspot-3',
      file: 'src/adapters/git_sandbox.py',
      complexity: 22,
      churnCommits: 45,
      riskFactor: 71,
      riskPriority: 'Moderate Risk',
      estimatedFixHours: 8,
      whyItMatters:
        'Nested exception hierarchies in subprocess management make git workspace errors intermittent and difficult to diagnose.',
      suggestedRemediation: 'Implement explicit error mapping and replace broad catch clauses with subprocess error typing.',
    },
  ],

  // Full Centralized Findings Collection (18 Items)
  findings: ALL_FINDINGS,

  // Priority findings subset for Overview page table
  priorityFindings: ALL_FINDINGS.slice(0, 4),
};

export default DEMO_ANALYSIS;
