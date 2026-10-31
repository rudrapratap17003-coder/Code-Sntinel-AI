import assert from 'node:assert';
import { validateGitHubUrl } from '../src/utils/urlValidator.js';
import { calculateCMDI, normalizeIndicatorRisks, getCmdiTier, CMDI_TIERS } from '../src/utils/scoringEngine.js';
import { DEMO_ANALYSIS, ALL_FINDINGS } from '../src/data/demoAnalysis.js';
import { DEMO_ARCHITECTURE } from '../src/data/demoArchitecture.js';
import {
  isValidHistoryRecord,
  getInitialSeedHistory,
  saveHistoryToStorage,
  loadHistoryFromStorage,
  HISTORY_STORAGE_KEY,
  normalizeBackendSummary,
  mergeHistoryRecords,
} from '../src/utils/historyStorage.js';
import { ROUTES } from '../src/utils/constants.js';
import {
  apiClient,
  ApiError,
  normalizeAnalysisResult,
  setApiBaseUrl,
  getEffectiveBaseUrl,
} from '../src/api/index.js';

console.log('================================================================');
console.log('  CODESENTINEL AI: COMPREHENSIVE AUTOMATED AUDIT TEST SUITE');
console.log('================================================================\n');

let passCount = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// SECTION 1: URL Validation & Normalization Tests
// -------------------------------------------------------------
console.log('[SECTION 1: GitHub Repository URL Validation]');

test('Validates standard GitHub repo HTTPS URL', () => {
  const res = validateGitHubUrl('https://github.com/facebook/react');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.normalizedUrl, 'https://github.com/facebook/react');
  assert.strictEqual(res.owner, 'facebook');
  assert.strictEqual(res.repo, 'react');
});

test('Normalizes trailing slash', () => {
  const res = validateGitHubUrl('https://github.com/facebook/react/');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.normalizedUrl, 'https://github.com/facebook/react');
});

test('Strips .git suffix cleanly', () => {
  const res = validateGitHubUrl('https://github.com/torvalds/linux.git');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.normalizedUrl, 'https://github.com/torvalds/linux');
  assert.strictEqual(res.repo, 'linux');
});

test('Accepts www.github.com and normalizes to canonical https://github.com', () => {
  const res = validateGitHubUrl('https://www.github.com/pallets/flask');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.normalizedUrl, 'https://github.com/pallets/flask');
});

test('Rejects non-HTTPS unencrypted HTTP URL', () => {
  const res = validateGitHubUrl('http://github.com/facebook/react');
  assert.strictEqual(res.isValid, false);
  assert.match(res.error, /Insecure Protocol/);
});

test('Rejects embedded credentials for security', () => {
  const res = validateGitHubUrl('https://user:password@github.com/owner/repo');
  assert.strictEqual(res.isValid, false);
  assert.match(res.error, /Security Warning/);
});

test('Rejects non-GitHub domains', () => {
  const res = validateGitHubUrl('https://gitlab.com/owner/repo');
  assert.strictEqual(res.isValid, false);
  assert.match(res.error, /Unsupported Domain/);
});

test('Rejects URLs without repository segment', () => {
  const res = validateGitHubUrl('https://github.com/facebook');
  assert.strictEqual(res.isValid, false);
  assert.match(res.error, /Incomplete Path/);
});

test('Rejects empty input', () => {
  const res = validateGitHubUrl('');
  assert.strictEqual(res.isValid, false);
  assert.match(res.error, /Repository URL is required/);
});

// -------------------------------------------------------------
// SECTION 2: Scoring Engine & CMDI Tests
// -------------------------------------------------------------
console.log('\n[SECTION 2: Scoring Engine & CMDI Calculation]');

test('CMDI Tiers have complete non-overlapping coverage (0 to 100)', () => {
  assert.strictEqual(CMDI_TIERS.length, 4);
  assert.strictEqual(getCmdiTier(0).label, 'Low Risk');
  assert.strictEqual(getCmdiTier(25).label, 'Low Risk');
  assert.strictEqual(getCmdiTier(26).label, 'Moderate Risk');
  assert.strictEqual(getCmdiTier(50).label, 'Moderate Risk');
  assert.strictEqual(getCmdiTier(51).label, 'High Risk');
  assert.strictEqual(getCmdiTier(75).label, 'High Risk');
  assert.strictEqual(getCmdiTier(76).label, 'Critical Risk');
  assert.strictEqual(getCmdiTier(100).label, 'Critical Risk');
});

test('Handles out-of-range CMDI scores safely', () => {
  assert.strictEqual(getCmdiTier(-10).label, 'Low Risk');
  assert.strictEqual(getCmdiTier(150).label, 'Critical Risk');
  assert.strictEqual(getCmdiTier(NaN).label, 'Not Available');
  assert.strictEqual(getCmdiTier(null).label, 'Not Available');
});

test('Normalizes raw inputs correctly', () => {
  const normalized = normalizeIndicatorRisks({
    maxComplexity: 38,
    duplicationPercent: 15,
    couplingFactor: 0.8,
    errorConsistencyScore: 70,
  });
  // Complexity: ((38 - 10) / 30) * 100 = 93.3
  assert.strictEqual(normalized.complexityRisk, 93.3);
  // Duplication: (15 / 25) * 100 = 60
  assert.strictEqual(normalized.duplicationRisk, 60);
  // Coupling: 0.8 * 100 = 80
  assert.strictEqual(normalized.couplingRisk, 80);
  // Error handling: (100 - 70) = 30
  assert.strictEqual(normalized.errorHandlingRisk, 30);
});

test('Calculates CMDI consistent with DEMO_ANALYSIS inputs', () => {
  const result = calculateCMDI({
    complexityRisk: 84.0,
    duplicationRisk: 60.0,
    couplingRisk: 74.0,
    errorHandlingRisk: 40.0,
  });

  assert.strictEqual(result.cmdi, 64.5);
  assert.strictEqual(result.tier.label, 'High Risk');
  assert.strictEqual(result.contributions.complexity.contribution, 21.0);
  assert.strictEqual(result.contributions.duplication.contribution, 15.0);
  assert.strictEqual(result.contributions.coupling.contribution, 18.5);
  assert.strictEqual(result.contributions.error_handling.contribution, 10.0);
});

test('Handles missing indicators gracefully by re-weighting remaining indicators', () => {
  const partial = calculateCMDI({
    complexityRisk: 80.0,
    duplicationRisk: 60.0,
    couplingRisk: null,
    errorHandlingRisk: null,
  });

  // Re-weighted evenly across available (80 + 60) / 2 = 70
  assert.strictEqual(partial.cmdi, 70.0);
  assert.strictEqual(partial.availableIndicatorsCount, 2);
});

test('Handles empty indicators without crashing', () => {
  const empty = calculateCMDI({});
  assert.strictEqual(empty.cmdi, null);
  assert.strictEqual(empty.tier.label, 'Not Available');
});

// -------------------------------------------------------------
// SECTION 3: Centralized Demo Data Integrity
// -------------------------------------------------------------
console.log('\n[SECTION 3: Centralized Demo Data Integrity]');

test('DEMO_ANALYSIS has exactly 18 comprehensive findings', () => {
  assert.strictEqual(ALL_FINDINGS.length, 18);
  assert.strictEqual(DEMO_ANALYSIS.findings.length, 18);
  assert.strictEqual(DEMO_ANALYSIS.repository.findingsCount, 18);
});

test('Every finding has unique ID, title, ruleId, category, severity, and remediation', () => {
  const seenIds = new Set();
  const validCategories = new Set([
    'Cyclomatic Complexity',
    'Code Duplication',
    'Architectural Coupling',
    'Error-Handling Consistency',
  ]);
  const validSeverities = new Set(['critical', 'high', 'medium', 'low']);

  for (const f of ALL_FINDINGS) {
    assert(!seenIds.has(f.id), `Duplicate finding ID detected: ${f.id}`);
    seenIds.add(f.id);
    assert(typeof f.title === 'string' && f.title.length > 5, `Finding ${f.id} has invalid title`);
    assert(typeof f.ruleId === 'string' && f.ruleId.includes('/'), `Finding ${f.id} has invalid ruleId`);
    assert(validCategories.has(f.category), `Finding ${f.id} has invalid category: ${f.category}`);
    assert(validSeverities.has(f.severity), `Finding ${f.id} has invalid severity: ${f.severity}`);
    assert(typeof f.file === 'string' && f.file.length > 0, `Finding ${f.id} has invalid file`);
    assert(typeof f.evidence === 'object' && f.evidence !== null, `Finding ${f.id} has invalid evidence`);
    assert(typeof f.recommendedRemediation === 'string', `Finding ${f.id} missing recommendedRemediation`);
    assert(typeof f.origin === 'string', `Finding ${f.id} missing origin provenance`);
  }
});

test('DEMO_ANALYSIS priority findings are a valid subset of ALL_FINDINGS', () => {
  assert.strictEqual(DEMO_ANALYSIS.priorityFindings.length, 4);
  DEMO_ANALYSIS.priorityFindings.forEach(pf => {
    const exists = ALL_FINDINGS.some(f => f.id === pf.id);
    assert(exists, `Priority finding ${pf.id} does not exist in ALL_FINDINGS`);
  });
});

test('Maintainability hotspots are valid and cross-referenced', () => {
  assert.strictEqual(DEMO_ANALYSIS.hotspots.length, 3);
  DEMO_ANALYSIS.hotspots.forEach(hs => {
    assert(hs.complexity > 0);
    assert(hs.churnCommits > 0);
    assert(hs.estimatedFixHours > 0);
  });
});

test('Demonstration labels are explicitly present', () => {
  assert.strictEqual(DEMO_ANALYSIS.repository.isDemo, true);
  assert(DEMO_ANALYSIS.repository.modeLabel.includes('DEMO ANALYSIS'));
  assert(DEMO_ANALYSIS.summary.scoringDisclaimer.includes('CodeSentinel AI metric'));
});

// -------------------------------------------------------------
// SECTION 4: Architecture Graph Model Integrity
// -------------------------------------------------------------
console.log('\n[SECTION 4: Architecture Model Integrity]');

test('DEMO_ARCHITECTURE has 9 nodes and 14 edges', () => {
  assert.strictEqual(DEMO_ARCHITECTURE.nodes.length, 9);
  assert.strictEqual(DEMO_ARCHITECTURE.edges.length, 14);
  assert.strictEqual(DEMO_ARCHITECTURE.metrics.totalModules, 9);
  assert.strictEqual(DEMO_ARCHITECTURE.metrics.totalDependencies, 14);
});

test('Every edge connects existing valid node IDs', () => {
  const nodeIds = new Set(DEMO_ARCHITECTURE.nodes.map(n => n.id));
  DEMO_ARCHITECTURE.edges.forEach(e => {
    assert(nodeIds.has(e.source), `Edge ${e.id} source "${e.source}" not found in nodes`);
    assert(nodeIds.has(e.target), `Edge ${e.id} target "${e.target}" not found in nodes`);
  });
});

test('Circular cycle is detected and flagged on edges', () => {
  const circularEdges = DEMO_ARCHITECTURE.edges.filter(e => e.data?.isCircular);
  assert.strictEqual(circularEdges.length, 2);
  const cycleNodes = new Set(circularEdges.flatMap(e => [e.source, e.target]));
  assert(cycleNodes.has('mod-pipeline'));
  assert(cycleNodes.has('mod-runner'));
});

// -------------------------------------------------------------
// SECTION 5: History Storage, Validation & Sanitization
// -------------------------------------------------------------
console.log('\n[SECTION 5: History Storage & Schema Validation]');

test('Validates compliant history record structure', () => {
  const valid = {
    id: 'test-rec-1',
    timestamp: '2026-10-25T12:00:00Z',
    repository: { name: 'owner/repo', url: 'https://github.com/owner/repo' },
    summary: { cmdi: 45.0 },
    indicators: [{ id: 'complexity' }],
    findings: [],
  };
  assert.strictEqual(isValidHistoryRecord(valid), true);
});

test('Rejects malformed history records', () => {
  assert.strictEqual(isValidHistoryRecord(null), false);
  assert.strictEqual(isValidHistoryRecord({}), false);
  assert.strictEqual(isValidHistoryRecord({ id: 'bad', summary: { cmdi: 'invalid' } }), false);
  assert.strictEqual(isValidHistoryRecord({ id: 'bad', repository: null }), false);
  assert.strictEqual(isValidHistoryRecord({ id: 'bad', repository: { name: 'test' }, indicators: [] }), false);
});

test('Initial seed history yields valid non-empty runs', () => {
  const seeds = getInitialSeedHistory();
  assert.strictEqual(seeds.length, 2);
  assert(isValidHistoryRecord(seeds[0]));
  assert(isValidHistoryRecord(seeds[1]));
});

// Mock browser storage for testing save/load in Node environment
test('Storage handles corrupted JSON safely via quarantine', () => {
  let storageMap = {};
  global.window = {
    localStorage: {
      getItem: (key) => storageMap[key] || null,
      setItem: (key, val) => { storageMap[key] = String(val); },
      removeItem: (key) => { delete storageMap[key]; },
    },
  };

  // Inject corrupted payload
  storageMap[HISTORY_STORAGE_KEY] = JSON.stringify([
    { id: 'corrupt-1' }, // invalid record missing required schema
    getInitialSeedHistory()[0], // valid record
  ]);

  const loaded = loadHistoryFromStorage();
  assert.strictEqual(loaded.corruptedCount, 1);
  assert.strictEqual(loaded.records.length, 1);
  assert.strictEqual(loaded.records[0].repository.name, 'codesentinel/orchestrator-core');
});

test('saveHistoryToStorage strictly sanitizes passwords, secrets, and API keys', () => {
  let storageMap = {};
  global.window = {
    localStorage: {
      getItem: (key) => storageMap[key] || null,
      setItem: (key, val) => { storageMap[key] = String(val); },
    },
  };

  const recordsWithSensitives = [
    {
      ...getInitialSeedHistory()[0],
      password: 'super-secret-password',
      apiKey: 'xyz123',
      token: 'bearer_token',
      secret: 'secret_key',
    },
  ];

  saveHistoryToStorage(recordsWithSensitives);
  const storedJson = storageMap[HISTORY_STORAGE_KEY];
  assert(!storedJson.includes('super-secret-password'));
  assert(!storedJson.includes('xyz123'));
  assert(!storedJson.includes('bearer_token'));
  assert(!storedJson.includes('secret_key'));
});

// -------------------------------------------------------------
// SECTION 6: Routes & Constants
// -------------------------------------------------------------
console.log('\n[SECTION 6: Routes & App Configuration]');

await test('All core routes are defined and non-empty', () => {
  assert.strictEqual(ROUTES.HOME, '/');
  assert.strictEqual(ROUTES.LOGIN, '/login');
  assert.strictEqual(ROUTES.OVERVIEW, '/overview');
  assert.strictEqual(ROUTES.REPOSITORY, '/repository');
  assert.strictEqual(ROUTES.TECHNICAL_DEBT, '/technical-debt');
  assert.strictEqual(ROUTES.FINDINGS, '/findings');
  assert.strictEqual(ROUTES.ARCHITECTURE, '/architecture');
  assert.strictEqual(ROUTES.HISTORY, '/history');
  assert.strictEqual(ROUTES.SETTINGS, '/settings');
});

// -------------------------------------------------------------
// SECTION 7: Centralized Frontend API Client & Normalization
// -------------------------------------------------------------
console.log('\n[SECTION 7: API Client, Ingestion Flow & Error Handling]');

await test('Resolves API base URL and respects programmatic overrides', () => {
  const defaultUrl = getEffectiveBaseUrl();
  assert(typeof defaultUrl === 'string' && defaultUrl.length > 0);

  setApiBaseUrl('http://127.0.0.1:8000/api/v1/');
  assert.strictEqual(getEffectiveBaseUrl(), 'http://127.0.0.1:8000/api/v1');

  // Reset override
  setApiBaseUrl(null);
});

await test('Normalizes real backend AnalysisResult into frontend contract with dual access', () => {
  const mockBackendPayload = {
    id: 'analysis-py-test-001',
    timestamp: '2026-10-25T21:00:00Z',
    display_timestamp: 'Oct 25, 2026 • 21:00 UTC',
    repository: {
      name: 'pallets/flask',
      url: 'https://github.com/pallets/flask',
      branch: 'main',
      commit_hash: '9a8b7c6',
      files_examined: 42,
      lines_of_code: 8500,
      status: 'Analyzed',
      is_demo: false,
      mode_label: 'REAL PYTHON STATIC ANALYSIS',
    },
    summary: {
      cmdi: 38.5,
      risk_category: 'Moderate Risk',
      risk_severity: 'medium',
      interpretation: 'Moderate maintainability risk detected.',
      scoring_disclaimer: 'CMDI disclaimer heuristic.',
      remediation_estimate_hours: 24,
      formula_description: 'Weighted average description.',
    },
    indicators: [
      {
        id: 'complexity',
        name: 'Cyclomatic Complexity',
        raw_metric: 'Max McCabe: 28',
        raw_values: { max_complexity: 28 },
        normalized_risk: 70.0,
        weight: 0.25,
        contribution: 17.5,
        classification: 'MEASURED',
        severity: 'critical',
        interpretation: 'Branching logic is high.',
        meaning: 'Complexity meaning.',
        why_it_matters: 'Testing difficulty.',
        how_calculated: 'McCabe formula.',
        evidence: 'Function exceeds threshold.',
        developer_action: 'Refactor into smaller functions.',
        filter_category: 'Complexity',
      },
    ],
    findings: [
      {
        id: 'FIND-PY-001',
        title: 'High McCabe Complexity',
        rule_id: 'complexity/high-cyclomatic',
        category: 'Cyclomatic Complexity',
        severity: 'critical',
        status: 'Open',
        file: 'src/app.py',
        line_range: 'lines 10–50',
        summary: 'Function wsgi_app has high McCabe complexity.',
        detailed_explanation: 'Branch count is 28.',
        evidence: { type: 'METRIC', measured_value: 28 },
        maintainability_impact: 'High testing friction.',
        recommended_remediation: 'Decompose branching paths.',
        origin: 'STATIC_ANALYSIS (AST)',
        remediation_estimate_hours: 6,
      },
    ],
    priority_findings: [
      {
        id: 'FIND-PY-001',
        title: 'High McCabe Complexity',
        rule_id: 'complexity/high-cyclomatic',
        category: 'Cyclomatic Complexity',
        severity: 'critical',
        status: 'Open',
        file: 'src/app.py',
        line_range: 'lines 10–50',
        summary: 'Function wsgi_app has high McCabe complexity.',
        detailed_explanation: 'Branch count is 28.',
        evidence: { type: 'METRIC', measured_value: 28 },
        maintainability_impact: 'High testing friction.',
        recommended_remediation: 'Decompose branching paths.',
        origin: 'STATIC_ANALYSIS (AST)',
        remediation_estimate_hours: 6,
      },
    ],
    hotspots: [
      {
        id: 'hotspot-1',
        file: 'src/app.py',
        complexity: 28,
        churn_commits: 40,
        risk_factor: 80,
        risk_priority: 'Critical Priority',
        estimated_fix_hours: 6,
        why_it_matters: 'Hotspot why it matters.',
        suggested_remediation: 'Hotspot remediation.',
      },
    ],
    architecture: {
      metrics: {
        total_modules: 5,
        total_dependencies: 8,
        circular_cycles_count: 0,
        max_afferent_coupling: 3,
        system_modularity_score: 85.0,
      },
      nodes: [
        {
          id: 'mod-app',
          label: 'app.py',
          full_path: 'src/app.py',
          category: 'Core',
          afferent_coupling: 2,
          efferent_coupling: 3,
          instability: 0.6,
          loc: 450,
          complexity: 28,
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'mod-app',
          target: 'mod-helpers',
          is_circular: false,
          import_type: 'direct',
        },
      ],
    },
    analysis_limitations: ['Python files only'],
  };

  const normalized = normalizeAnalysisResult(mockBackendPayload);

  // Assert non-demo provenance
  assert.strictEqual(normalized.repository.isDemo, false);
  assert.strictEqual(normalized.repository.is_demo, false);
  assert.strictEqual(normalized.repository.modeLabel, 'REAL PYTHON STATIC ANALYSIS');
  assert.strictEqual(normalized.repository.name, 'pallets/flask');
  assert.strictEqual(normalized.repository.filesExamined, 42);

  // Assert summary
  assert.strictEqual(normalized.summary.cmdi, 38.5);
  assert.strictEqual(normalized.summary.riskCategory, 'Moderate Risk');
  assert.strictEqual(normalized.summary.risk_category, 'Moderate Risk');

  // Assert dual-access camelCase and snake_case on findings
  assert.strictEqual(normalized.findings.length, 1);
  const finding = normalized.findings[0];
  assert.strictEqual(finding.ruleId, 'complexity/high-cyclomatic');
  assert.strictEqual(finding.rule_id, 'complexity/high-cyclomatic');
  assert.strictEqual(finding.lineRange, 'lines 10–50');
  assert.strictEqual(finding.line_range, 'lines 10–50');
  assert.strictEqual(finding.recommendedRemediation, 'Decompose branching paths.');
  assert.strictEqual(finding.recommended_remediation, 'Decompose branching paths.');

  // Assert priority findings and investigation queue
  assert.strictEqual(normalized.priorityFindings.length, 1);
  assert.strictEqual(normalized.investigationQueue.length, 1);
  assert.strictEqual(normalized.investigationQueue[0].title, 'High McCabe Complexity');

  // Assert React Flow architecture nodes and edges
  assert.strictEqual(normalized.architecture.nodes.length, 1);
  assert.strictEqual(normalized.architecture.nodes[0].type, 'moduleNode');
  assert.strictEqual(normalized.architecture.nodes[0].data.afferentCoupling, 2);
  assert.strictEqual(normalized.architecture.edges.length, 1);
  assert.strictEqual(normalized.architecture.edges[0].data.isCircular, false);

  // Assert history validity of normalized result
  assert(isValidHistoryRecord(normalized));
});

await test('Rejects null or invalid response payload', () => {
  assert.throws(
    () => normalizeAnalysisResult(null),
    (err) => err instanceof ApiError && err.code === 'INVALID_PAYLOAD'
  );
  assert.throws(
    () => normalizeAnalysisResult('string payload'),
    (err) => err instanceof ApiError && err.code === 'INVALID_PAYLOAD'
  );
});

await test('Rejects payload missing required schema sections', () => {
  assert.throws(
    () => normalizeAnalysisResult({ id: 'abc' }),
    (err) => err instanceof ApiError && err.code === 'SCHEMA_VALIDATION_ERROR'
  );
});

await test('apiClient.analyzeRepository rejects empty or invalid URL input', async () => {
  await assert.rejects(
    async () => apiClient.analyzeRepository(''),
    (err) => err instanceof ApiError && err.code === 'INVALID_URL'
  );
  await assert.rejects(
    async () => apiClient.analyzeRepository(null),
    (err) => err instanceof ApiError && err.code === 'INVALID_URL'
  );
});

await test('apiClient handles backend downtime gracefully with actionable message', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    await assert.rejects(
      async () => apiClient.analyzeRepository('https://github.com/pallets/flask'),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.code, 'BACKEND_UNAVAILABLE');
        assert(err.message.includes('backend is unreachable'));
        assert(err.message.includes('uvicorn app.main:app'));
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

await test('apiClient handles HTTP 400 validation and policy errors from backend', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ detail: 'GitHub repository not found or access denied.' }),
  });

  try {
    await assert.rejects(
      async () => apiClient.analyzeRepository('https://github.com/invalid/repo'),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.code, 'VALIDATION_OR_INGESTION_ERROR');
        assert.strictEqual(err.detail, 'GitHub repository not found or access denied.');
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

await test('apiClient handles timeout error cleanly', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
    };

  try {
    await assert.rejects(
      async () => apiClient.analyzeRepository('https://github.com/pallets/flask', { timeoutMs: 10 }),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.code, 'TIMEOUT');
        assert(err.message.includes('timed out'));
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

// -------------------------------------------------------------
// SECTION 8: Phase 13 Gemini Explanation Layer Tests
// -------------------------------------------------------------
console.log('\n[SECTION 8: Phase 13 Gemini Explanation Layer]');

await test('apiClient.explainFinding rejects empty or non-object input', async () => {
  await assert.rejects(
    async () => apiClient.explainFinding(null),
    (err) => err instanceof ApiError && err.code === 'INVALID_FINDING'
  );
  await assert.rejects(
    async () => apiClient.explainFinding('invalid-string'),
    (err) => err instanceof ApiError && err.code === 'INVALID_FINDING'
  );
});

await test('apiClient.explainFinding successfully constructs payload and normalizes dual-access response', async () => {
  const originalFetch = global.fetch;
  let sentUrl = '';
  let sentBody = null;

  global.fetch = async (url, options) => {
    sentUrl = url;
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        finding_id: 'FIND-001',
        rule_id: 'complexity/mccabe-high',
        file: 'services/order.py',
        line_range: '45-92',
        plain_language_explanation: 'Function process_order contains 14 branch paths.',
        why_it_matters: 'High branching makes testing and safe refactoring harder.',
        proposed_remediation: 'Decompose validation into helper subroutines.',
        refactoring_example: 'def validate_order(order):\n    pass',
        potential_tradeoffs: 'Introduces more functions to navigate.',
        architectural_considerations: 'Consider Strategy pattern for diverse order types.',
        context_limitations: 'Snippet lacks upstream caller context.',
        model_name: 'gemini-3.8-flash',
        generated_at: '2026-10-26T00:00:00Z',
        origin: 'AI_EXPLANATION (Gemini)'
      })
    };
  };

  try {
    const testFinding = {
      id: 'FIND-001',
      ruleId: 'complexity/mccabe-high',
      category: 'Cyclomatic Complexity',
      severity: 'high',
      file: 'services/order.py',
      lineRange: '45-92',
      title: 'High cyclomatic complexity in process_order',
      summary: 'Complexity is 14',
      evidence: {
        codeSnippet: 'def process_order():\n    if x: pass\n'
      }
    };

    const explanation = await apiClient.explainFinding(testFinding);

    // Verify outbound payload
    assert(sentUrl.endsWith('/findings/explain'));
    assert.strictEqual(sentBody.finding_id, 'FIND-001');
    assert.strictEqual(sentBody.rule_id, 'complexity/mccabe-high');
    assert.strictEqual(sentBody.code_snippet, 'def process_order():\n    if x: pass\n');

    // Verify dual access (camelCase and snake_case) on response
    assert.strictEqual(explanation.findingId, 'FIND-001');
    assert.strictEqual(explanation.finding_id, 'FIND-001');
    assert.strictEqual(explanation.plainLanguageExplanation, 'Function process_order contains 14 branch paths.');
    assert.strictEqual(explanation.plain_language_explanation, 'Function process_order contains 14 branch paths.');
    assert.strictEqual(explanation.whyItMatters, 'High branching makes testing and safe refactoring harder.');
    assert.strictEqual(explanation.why_it_matters, 'High branching makes testing and safe refactoring harder.');
    assert.strictEqual(explanation.refactoringExample, 'def validate_order(order):\n    pass');
    assert.strictEqual(explanation.modelName, 'gemini-3.8-flash');
    assert.strictEqual(explanation.origin, 'AI_EXPLANATION (Gemini)');
  } finally {
    global.fetch = originalFetch;
  }
});

await test('apiClient.explainFinding handles HTTP 503 missing API key or service unavailable', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => JSON.stringify({
      detail: 'Gemini AI explanations are unavailable because GEMINI_API_KEY is not configured on the backend server.'
    })
  });

  try {
    await assert.rejects(
      async () => apiClient.explainFinding({ id: 'FIND-001' }),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 503);
        assert.strictEqual(err.code, 'SERVICE_UNAVAILABLE');
        assert(err.message.includes('GEMINI_API_KEY'));
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

await test('apiClient.explainFinding handles HTTP 429 rate limit errors from Gemini', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    text: async () => JSON.stringify({
      detail: 'Gemini API rate limit exceeded. Please wait a moment and try again.'
    })
  });

  try {
    await assert.rejects(
      async () => apiClient.explainFinding({ id: 'FIND-001' }),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 429);
        assert.strictEqual(err.code, 'RATE_LIMITED');
        assert(err.message.includes('rate limit'));
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

await test('apiClient.explainFinding handles HTTP 504 Gemini upstream timeout', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 504,
    text: async () => JSON.stringify({
      detail: 'Gemini explanation request timed out. Please try again later.'
    })
  });

  try {
    await assert.rejects(
      async () => apiClient.explainFinding({ id: 'FIND-001' }),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 504);
        assert.strictEqual(err.code, 'GATEWAY_TIMEOUT');
        assert(err.message.includes('timed out'));
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

await test('apiClient.explainFinding handles client timeout (AbortError)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  };

  try {
    await assert.rejects(
      async () => apiClient.explainFinding({ id: 'FIND-001' }, { timeoutMs: 10 }),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.code, 'TIMEOUT');
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

// -------------------------------------------------------------
// SECTION 9: Phase 1 Sentinel Command Center UI Specification
// -------------------------------------------------------------
console.log('\n[SECTION 9: Phase 1 Sentinel Command Center Specification]');
import fs from 'node:fs';
import path from 'node:path';

await test('Design tokens file contains exact Part 3 palette variables', () => {
  const tokensContent = fs.readFileSync(path.resolve('src/styles/tokens.css'), 'utf-8');
  assert(tokensContent.includes('--bg-main: #080B0A;'));
  assert(tokensContent.includes('--bg-sidebar: #0D120F;'));
  assert(tokensContent.includes('--bg-card: #111713;'));
  assert(tokensContent.includes('--bg-card-elevated: #172019;'));
  assert(tokensContent.includes('--accent-primary: #00F5A0;'));
  assert(tokensContent.includes('--accent-secondary: #00B879;'));
  assert(tokensContent.includes('--text-primary: #F2F7F3;'));
  assert(tokensContent.includes('--text-secondary: #9BAAA1;'));
  assert(tokensContent.includes('--border-subtle: #26352C;'));
  assert(tokensContent.includes('--severity-critical: #FF5D68;'));
  assert(tokensContent.includes('--severity-warning: #F5B942;'));
  assert(tokensContent.includes('--severity-info: #55C7E8;'));
});

await test('OverviewPage component implements all required Part 5 sections in order', () => {
  const overviewSource = fs.readFileSync(path.resolve('src/pages/Overview/OverviewPage.jsx'), 'utf-8');

  // Section A: Header
  assert(overviewSource.includes('Command Center'), 'Header title must be Command Center');
  assert(overviewSource.includes('Understand code health, investigate technical debt, and prioritize engineering improvements.'));
  assert(overviewSource.includes('DEMO DATA'), 'Header must include DEMO DATA badge');

  // Section B: 4 Summary cards
  assert(overviewSource.includes('Files Examined'));
  assert(overviewSource.includes('Total Findings'));
  assert(overviewSource.includes('Estimated Effort'));
  assert(overviewSource.includes('Last Analysis'));

  // Section C: CMDI section with accessible meter
  assert(overviewSource.includes('Code Maintainability Debt Index (CMDI)'));
  assert(overviewSource.includes('role="meter"'));
  assert(overviewSource.includes('aria-valuenow'));
  assert(overviewSource.includes('aria-valuemin="0"'));
  assert(overviewSource.includes('aria-valuemax="100"'));
  assert(overviewSource.includes('CMDI is a project-defined heuristic index'));

  // Section D: 4 Core indicators
  assert(overviewSource.includes('Complexity'));
  assert(overviewSource.includes('Code Duplication'));
  assert(overviewSource.includes('Architectural Coupling'));
  assert(overviewSource.includes('Error-Handling'));

  // Section E: Priority Findings
  assert(overviewSource.includes('Priority Findings'));
  assert(overviewSource.includes('View All Findings'));
  assert(overviewSource.includes('ROUTES.FINDINGS'));

  // Section F: Recommended Next Action
  assert(overviewSource.includes('Recommended Next Action'));
  assert(overviewSource.includes('Analyze Repository'));
  assert(overviewSource.includes('ROUTES.REPOSITORY'));
});

// -------------------------------------------------------------
// SECTION 10: SQLite Backend History Synchronization
// -------------------------------------------------------------
console.log('\n[SECTION 10: SQLite Backend History Synchronization]');

await test('normalizeBackendSummary maps flat snake_case backend summary to nested contract without inventing findings', () => {
  const backendRow = {
    id: 'analysis-run-abc12345',
    timestamp: '2026-10-31T12:00:00Z',
    display_timestamp: 'Oct 31, 2026 • 12:00 UTC',
    repository_name: 'pallets/flask',
    repository_url: 'https://github.com/pallets/flask',
    cmdi: 38.5,
    risk_category: 'Moderate Risk',
    findings_count: 14,
    files_examined: 28,
  };

  const normalized = normalizeBackendSummary(backendRow);

  assert.strictEqual(normalized.id, 'analysis-run-abc12345');
  assert.strictEqual(normalized.timestamp, '2026-10-31T12:00:00Z');
  assert.strictEqual(normalized.displayTimestamp, 'Oct 31, 2026 • 12:00 UTC');
  assert.strictEqual(normalized.repository.name, 'pallets/flask');
  assert.strictEqual(normalized.repository.url, 'https://github.com/pallets/flask');
  assert.strictEqual(normalized.repository.filesExamined, 28);
  assert.strictEqual(normalized.repository.findingsCount, 14);
  assert.strictEqual(normalized.repository.isDemo, false);
  assert.strictEqual(normalized.repository.modeLabel, 'REAL PYTHON STATIC ANALYSIS');
  assert.strictEqual(normalized.summary.cmdi, 38.5);
  assert.strictEqual(normalized.summary.riskCategory, 'Moderate Risk');

  // Verify that findings, hotspots, and architecture data are NOT invented
  assert.strictEqual(normalized.isSummaryOnly, true);
  assert.strictEqual(normalized.findings, undefined);
  assert.strictEqual(normalized.hotspots, undefined);
  assert.strictEqual(normalized.architecture, undefined);

  // Verify isValidHistoryRecord handles summary records cleanly
  assert.strictEqual(isValidHistoryRecord(normalized), true);
});

await test('normalizeBackendSummary correctly handles camelCase fields and missing values', () => {
  const camelRow = {
    id: 'analysis-run-camel99',
    timestamp: '2026-10-31T12:30:00Z',
    displayTimestamp: 'Oct 31, 2026 • 12:30 UTC',
    repositoryName: 'django/django',
    repositoryUrl: 'https://github.com/django/django',
    cmdi: 78.0,
    riskCategory: 'Critical Risk',
    findingsCount: 42,
    filesExamined: 150,
  };

  const normalized = normalizeBackendSummary(camelRow);

  assert.strictEqual(normalized.id, 'analysis-run-camel99');
  assert.strictEqual(normalized.repository.name, 'django/django');
  assert.strictEqual(normalized.repository.url, 'https://github.com/django/django');
  assert.strictEqual(normalized.summary.cmdi, 78.0);
  assert.strictEqual(normalized.summary.riskCategory, 'Critical Risk');
  assert.strictEqual(normalized.summary.riskSeverity, 'critical');
  assert.strictEqual(normalized.isSummaryOnly, true);
});

await test('mergeHistoryRecords deduplicates records by stable ID and enforces chronological sorting', () => {
  const localList = [
    {
      id: 'analysis-run-1',
      timestamp: '2026-10-30T10:00:00Z',
      repository: { name: 'owner/repo1', url: 'https://github.com/owner/repo1', isDemo: false },
      summary: { cmdi: 20 },
      isSummaryOnly: true,
    },
  ];

  const backendList = [
    {
      id: 'analysis-run-1', // duplicate ID with newer timestamp
      timestamp: '2026-10-30T10:05:00Z',
      display_timestamp: 'Oct 30, 2026 • 10:05 UTC',
      repository_name: 'owner/repo1',
      repository_url: 'https://github.com/owner/repo1',
      cmdi: 22,
      risk_category: 'Low Risk',
      findings_count: 3,
      files_examined: 5,
    },
    {
      id: 'analysis-run-2', // new record
      timestamp: '2026-10-31T11:00:00Z',
      display_timestamp: 'Oct 31, 2026 • 11:00 UTC',
      repository_name: 'owner/repo2',
      repository_url: 'https://github.com/owner/repo2',
      cmdi: 45,
      risk_category: 'Moderate Risk',
      findings_count: 8,
      files_examined: 12,
    },
  ];

  const merged = mergeHistoryRecords(localList, backendList);

  assert.strictEqual(merged.length, 2);
  // Chronological sort: newest first
  assert.strictEqual(merged[0].id, 'analysis-run-2');
  assert.strictEqual(merged[1].id, 'analysis-run-1');
});

await test('mergeHistoryRecords enforces precedence: preserves full local report over summary-only backend item', () => {
  const fullLocalReport = {
    ...DEMO_ANALYSIS,
    id: 'analysis-run-persisted-1',
    timestamp: '2026-10-31T09:00:00Z',
    repository: { ...DEMO_ANALYSIS.repository, name: 'pallets/flask', isDemo: false },
    findings: [{ id: 'FIND-001', title: 'Real Finding' }],
    architecture: { nodes: [{ id: 'mod-1' }], edges: [] },
    isSummaryOnly: false,
  };

  const backendSummary = [
    {
      id: 'analysis-run-persisted-1',
      timestamp: '2026-10-31T09:00:00Z',
      repository_name: 'pallets/flask',
      repository_url: 'https://github.com/pallets/flask',
      cmdi: 38.5,
      risk_category: 'Moderate Risk',
      findings_count: 1,
      files_examined: 10,
    },
  ];

  const merged = mergeHistoryRecords([fullLocalReport], backendSummary);

  assert.strictEqual(merged.length, 1);
  const result = merged[0];
  // Must preserve full findings array and architecture data
  assert.strictEqual(result.isSummaryOnly, false);
  assert.strictEqual(Array.isArray(result.findings), true);
  assert.strictEqual(result.findings.length, 1);
  assert.strictEqual(result.findings[0].title, 'Real Finding');
  assert(result.architecture.nodes.length > 0);
});

await test('mergeHistoryRecords preserves local demo seeds while merging backend records', () => {
  const seeds = getInitialSeedHistory();
  const backendSummaries = [
    {
      id: 'analysis-run-live-999',
      timestamp: '2026-10-31T12:00:00Z',
      display_timestamp: 'Oct 31, 2026 • 12:00 UTC',
      repository_name: 'psf/requests',
      repository_url: 'https://github.com/psf/requests',
      cmdi: 15.0,
      risk_category: 'Low Risk',
      findings_count: 2,
      files_examined: 8,
    },
  ];

  const merged = mergeHistoryRecords(seeds, backendSummaries);

  // Both demo seeds and the new live run must exist
  assert.strictEqual(merged.length, 3);
  assert(merged.some(r => r.id === 'analysis-seed-001'));
  assert(merged.some(r => r.id === 'analysis-seed-002'));
  assert(merged.some(r => r.id === 'analysis-run-live-999'));
  // Live run is newest, should be first
  assert.strictEqual(merged[0].id, 'analysis-run-live-999');
});

await test('apiClient.getAnalyses retrieves backend history summaries', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert(url.includes('/analyses'));
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () =>
        JSON.stringify([
          {
            id: 'analysis-run-test-1',
            timestamp: '2026-10-31T10:00:00Z',
            display_timestamp: 'Oct 31, 2026 • 10:00 UTC',
            repository_name: 'test/repo',
            repository_url: 'https://github.com/test/repo',
            cmdi: 25.0,
            risk_category: 'Low Risk',
            findings_count: 3,
            files_examined: 5,
          },
        ]),
    };
  };

  try {
    const list = await apiClient.getAnalyses();
    assert.strictEqual(Array.isArray(list), true);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 'analysis-run-test-1');
  } finally {
    global.fetch = originalFetch;
  }
});

await test('Restoring a summary-only record retrieves full report via apiClient.getAnalysisById', async () => {
  const originalFetch = global.fetch;
  let requestedId = null;

  global.fetch = async (url) => {
    if (url.includes('/analyses/analysis-run-fetch-full')) {
      requestedId = 'analysis-run-fetch-full';
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () =>
          JSON.stringify({
            id: 'analysis-run-fetch-full',
            timestamp: '2026-10-31T10:00:00Z',
            display_timestamp: 'Oct 31, 2026 • 10:00 UTC',
            repository: {
              name: 'test/full-repo',
              url: 'https://github.com/test/full-repo',
              branch: 'main',
              files_examined: 10,
              lines_of_code: 500,
              status: 'Analyzed',
              is_demo: false,
              mode_label: 'REAL PYTHON STATIC ANALYSIS',
            },
            summary: {
              cmdi: 42.0,
              risk_category: 'Moderate Risk',
              risk_severity: 'info',
              interpretation: 'Computed from AST.',
              scoring_disclaimer: 'Disclaimer',
              remediation_estimate_hours: 12,
              formula_description: 'Formula',
            },
            indicators: [{ id: 'complexity', name: 'Complexity', normalized_risk: 30, contribution: 7.5 }],
            findings: [
              {
                id: 'FIND-PY-001',
                title: 'High Complexity',
                rule_id: 'complexity/high',
                category: 'Cyclomatic Complexity',
                severity: 'high',
                file: 'app.py',
                line_range: 'lines 10–30',
                summary: 'Branching logic',
                detailed_explanation: 'Full details',
                evidence: { type: 'METRIC_THRESHOLD' },
                maintainability_impact: 'Impact',
                recommended_remediation: 'Refactor',
                origin: 'STATIC_ANALYSIS (AST)',
              },
            ],
            priority_findings: [],
            hotspots: [],
            architecture: { metrics: {}, nodes: [], edges: [] },
          }),
      };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const fullReport = await apiClient.getAnalysisById('analysis-run-fetch-full');
    assert.strictEqual(requestedId, 'analysis-run-fetch-full');
    assert.strictEqual(fullReport.id, 'analysis-run-fetch-full');
    assert.strictEqual(fullReport.repository.name, 'test/full-repo');
    assert.strictEqual(fullReport.findings.length, 1);
    assert.strictEqual(fullReport.findings[0].id, 'FIND-PY-001');
    assert.strictEqual(Boolean(fullReport.isSummaryOnly), false);
  } finally {
    global.fetch = originalFetch;
  }
});

await test('Restoring a summary-only record handles backend failure gracefully', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => {
    return {
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ detail: 'Analysis not found' }),
    };
  };

  try {
    await assert.rejects(
      async () => apiClient.getAnalysisById('nonexistent-id'),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

await test('Deleting a live backend record synchronizes with apiClient.deleteAnalysis and handles errors', async () => {
  const originalFetch = global.fetch;
  let deletedId = null;

  // Test successful deletion
  global.fetch = async (url, options) => {
    assert.strictEqual(options.method, 'DELETE');
    deletedId = url.split('/').pop();
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ status: 'deleted', id: deletedId }),
    };
  };

  try {
    const res = await apiClient.deleteAnalysis('analysis-run-to-delete');
    assert.strictEqual(deletedId, 'analysis-run-to-delete');
    assert.strictEqual(res.status, 'deleted');

    // Test failure scenario: server returns 500
    global.fetch = async () => ({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ detail: 'Database error' }),
    });

    await assert.rejects(
      async () => apiClient.deleteAnalysis('analysis-run-fail'),
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 500);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

await test('Offline fallback preserves localStorage history without deletion on backend downtime', () => {
  let storageMap = {};
  global.window = {
    localStorage: {
      getItem: (key) => storageMap[key] || null,
      setItem: (key, val) => { storageMap[key] = String(val); },
      removeItem: (key) => { delete storageMap[key]; },
    },
  };

  // Pre-seed storage with records
  const initialSeeds = getInitialSeedHistory();
  saveHistoryToStorage(initialSeeds);

  // Simulate offline: merge with empty backend list
  const loaded = loadHistoryFromStorage();
  const merged = mergeHistoryRecords(loaded.records, []);

  // Records must be preserved completely
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].id, initialSeeds[0].id);
  assert.strictEqual(merged[1].id, initialSeeds[1].id);
});

console.log('\n================================================================');
console.log(`  ALL ${passCount} AUDIT TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================\n');
