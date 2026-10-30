/**
 * CodeSentinel AI — Centralized Frontend API Client.
 *
 * Interfaces with the Python static analysis engine FastAPI backend.
 * Provides resilient error handling, timeout management, response validation,
 * and data contract normalization for the React application.
 */

/**
 * Standardized API Error for CodeSentinel client operations.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN_ERROR', detail = null, originalError = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.originalError = originalError;
  }
}

/**
 * Resolves the backend API base URL from Vite environment variables or falls back to sensible defaults.
 * @returns {string}
 */
export function getApiBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  // Default to relative API path which is proxied by Vite in dev and standard reverse-proxies in prod
  return '/api/v1';
}

let customBaseUrl = null;

/**
 * Allows programmatic override of the API base URL (useful for testing or runtime configuration).
 * @param {string|null} url
 */
export function setApiBaseUrl(url) {
  customBaseUrl = url ? url.replace(/\/+$/, '') : null;
}

/**
 * Effective API Base URL.
 */
export function getEffectiveBaseUrl() {
  return customBaseUrl || getApiBaseUrl();
}

/**
 * Normalizes a raw backend AnalysisResult into the frontend application's expected camelCase data contract.
 * Preserves dual-access (camelCase and snake_case) where applicable.
 *
 * @param {Object} raw - Raw JSON returned from /api/v1/analyze
 * @returns {Object} Normalized analysis result
 */
export function normalizeAnalysisResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('Invalid response: Payload is not a valid JSON object.', {
      code: 'INVALID_PAYLOAD',
      status: 200,
    });
  }

  // Validate critical structural fields
  if (!raw.id || !raw.repository || !raw.summary) {
    throw new ApiError('Invalid response: Analysis payload is missing required schema sections (id, repository, summary).', {
      code: 'SCHEMA_VALIDATION_ERROR',
      status: 200,
      detail: raw,
    });
  }

  const rawRepo = raw.repository;
  const rawSummary = raw.summary;
  const rawFindings = Array.isArray(raw.findings) ? raw.findings : [];
  const rawIndicators = Array.isArray(raw.indicators) ? raw.indicators : [];
  const rawHotspots = Array.isArray(raw.hotspots) ? raw.hotspots : [];
  const rawArch = raw.architecture || { metrics: {}, nodes: [], edges: [] };

  // 1. Normalize Repository Metadata
  const normalizedRepository = {
    name: rawRepo.name || 'Unknown Repository',
    url: rawRepo.url || '',
    branch: rawRepo.branch || 'main',
    commitHash: rawRepo.commit_hash || rawRepo.commitHash || 'HEAD',
    commit_hash: rawRepo.commit_hash || rawRepo.commitHash || 'HEAD',
    filesExamined: typeof rawRepo.files_examined === 'number' ? rawRepo.files_examined : (rawRepo.filesExamined || 0),
    files_examined: typeof rawRepo.files_examined === 'number' ? rawRepo.files_examined : (rawRepo.filesExamined || 0),
    linesOfCode: typeof rawRepo.lines_of_code === 'number' ? rawRepo.lines_of_code : (rawRepo.linesOfCode || 0),
    lines_of_code: typeof rawRepo.lines_of_code === 'number' ? rawRepo.lines_of_code : (rawRepo.linesOfCode || 0),
    status: rawRepo.status || 'Analyzed',
    isDemo: Boolean(rawRepo.is_demo ?? rawRepo.isDemo ?? false),
    is_demo: Boolean(rawRepo.is_demo ?? rawRepo.isDemo ?? false),
    modeLabel: rawRepo.mode_label || rawRepo.modeLabel || (rawRepo.is_demo ? 'DEMO ANALYSIS' : 'REAL PYTHON STATIC ANALYSIS'),
    mode_label: rawRepo.mode_label || rawRepo.modeLabel || (rawRepo.is_demo ? 'DEMO ANALYSIS' : 'REAL PYTHON STATIC ANALYSIS'),
    lastAnalyzed: raw.timestamp || rawRepo.lastAnalyzed || new Date().toISOString(),
    displayTimestamp: raw.display_timestamp || rawRepo.displayTimestamp || 'Just now • Real Analysis',
    findingsCount: rawFindings.length,
  };

  // 2. Normalize Summary
  const normalizedSummary = {
    cmdi: typeof rawSummary.cmdi === 'number' ? rawSummary.cmdi : 0,
    riskCategory: rawSummary.risk_category || rawSummary.riskCategory || 'Low Risk',
    risk_category: rawSummary.risk_category || rawSummary.riskCategory || 'Low Risk',
    riskSeverity: rawSummary.risk_severity || rawSummary.riskSeverity || 'info',
    risk_severity: rawSummary.risk_severity || rawSummary.riskSeverity || 'info',
    delta: 'Live Engine',
    deltaTrend: 'neutral',
    interpretation: rawSummary.interpretation || 'Maintainability assessment computed from Python AST analysis.',
    scoringDisclaimer:
      rawSummary.scoring_disclaimer ||
      rawSummary.scoringDisclaimer ||
      'The Code Maintainability Debt Index (CMDI) is a CodeSentinel AI metric, not an established universal industry standard.',
    scoring_disclaimer: rawSummary.scoring_disclaimer || rawSummary.scoringDisclaimer,
    remediationEstimateHours:
      typeof rawSummary.remediation_estimate_hours === 'number'
        ? rawSummary.remediation_estimate_hours
        : (rawSummary.remediationEstimateHours || 0),
    remediation_estimate_hours:
      typeof rawSummary.remediation_estimate_hours === 'number'
        ? rawSummary.remediation_estimate_hours
        : (rawSummary.remediationEstimateHours || 0),
    formulaDescription:
      rawSummary.formula_description ||
      rawSummary.formulaDescription ||
      'CMDI is computed as the normalized weighted average of four static indicators: Cyclomatic Complexity, Code Duplication, Architectural Coupling, and Error-Handling Consistency.',
    formula_description: rawSummary.formula_description || rawSummary.formulaDescription,
  };

  // 3. Normalize Findings
  const normalizedFindings = rawFindings.map((f, idx) => {
    const ruleId = f.rule_id || f.ruleId || `rule-py-${idx + 1}`;
    const lineRange = f.line_range || f.lineRange || 'file-level';
    const explanation = f.detailed_explanation || f.detailedExplanation || f.summary || '';
    const impact = f.maintainability_impact || f.maintainabilityImpact || 'Impacts code maintainability and change friction.';
    const remediation = f.recommended_remediation || f.recommendedRemediation || 'Refactor module to adhere to maintainability standards.';
    const estimateHours = typeof f.remediation_estimate_hours === 'number' ? f.remediation_estimate_hours : (f.remediationEstimateHours || 2);

    return {
      id: f.id || `FIND-PY-${idx + 1}`,
      title: f.title || 'Code maintainability finding',
      ruleId,
      rule_id: ruleId,
      category: f.category || 'General Maintainability',
      severity: f.severity || 'medium',
      status: f.status || 'Open',
      file: f.file || 'unknown_file.py',
      lineRange,
      line_range: lineRange,
      summary: f.summary || f.title || '',
      detailedExplanation: explanation,
      detailed_explanation: explanation,
      evidence: f.evidence || { type: 'STATIC_ANALYSIS', metricName: ruleId, measuredValue: 'Identified' },
      maintainabilityImpact: impact,
      maintainability_impact: impact,
      recommendedRemediation: remediation,
      recommended_remediation: remediation,
      origin: f.origin || 'STATIC_ANALYSIS (AST/Radon)',
      remediationEstimateHours: estimateHours,
      remediation_estimate_hours: estimateHours,
    };
  });

  // Priority findings (top 4)
  const priorityFindings = normalizedFindings.slice(0, 4);

  // 4. Normalize Indicators
  const normalizedIndicators = rawIndicators.map((ind) => {
    return {
      id: ind.id,
      name: ind.name,
      rawMetric: ind.raw_metric || ind.rawMetric || '',
      raw_metric: ind.raw_metric || ind.rawMetric || '',
      rawValues: ind.raw_values || ind.rawValues || {},
      raw_values: ind.raw_values || ind.rawValues || {},
      normalizedRisk: typeof ind.normalized_risk === 'number' ? ind.normalized_risk : (ind.normalizedRisk || 0),
      normalized_risk: typeof ind.normalized_risk === 'number' ? ind.normalized_risk : (ind.normalizedRisk || 0),
      weight: ind.weight ?? 0.25,
      contribution: ind.contribution ?? 0,
      classification: ind.classification || 'MEASURED',
      severity: ind.severity || 'info',
      interpretation: ind.interpretation || '',
      meaning: ind.meaning || '',
      whyItMatters: ind.why_it_matters || ind.whyItMatters || '',
      why_it_matters: ind.why_it_matters || ind.whyItMatters || '',
      howCalculated: ind.how_calculated || ind.howCalculated || '',
      how_calculated: ind.how_calculated || ind.howCalculated || '',
      evidence: ind.evidence || '',
      developerAction: ind.developer_action || ind.developerAction || '',
      developer_action: ind.developer_action || ind.developerAction || '',
      filterCategory: ind.filter_category || ind.filterCategory || 'Complexity',
      filter_category: ind.filter_category || ind.filterCategory || 'Complexity',
    };
  });

  // 5. Normalize Hotspots
  const normalizedHotspots = rawHotspots.map((h, idx) => ({
    id: h.id || `hotspot-${idx + 1}`,
    file: h.file || 'unknown.py',
    complexity: h.complexity || 1,
    churnCommits: h.churn_commits || h.churnCommits || 10,
    churn_commits: h.churn_commits || h.churnCommits || 10,
    riskFactor: h.risk_factor || h.riskFactor || 50,
    risk_factor: h.risk_factor || h.riskFactor || 50,
    riskPriority: h.risk_priority || h.riskPriority || 'Moderate Risk',
    risk_priority: h.risk_priority || h.riskPriority || 'Moderate Risk',
    estimatedFixHours: h.estimated_fix_hours || h.estimatedFixHours || 6,
    estimated_fix_hours: h.estimated_fix_hours || h.estimatedFixHours || 6,
    whyItMatters: h.why_it_matters || h.whyItMatters || 'Elevated complexity and caller dependencies.',
    why_it_matters: h.why_it_matters || h.whyItMatters || 'Elevated complexity and caller dependencies.',
    suggestedRemediation: h.suggested_remediation || h.suggestedRemediation || 'Refactor complex routines.',
    suggested_remediation: h.suggested_remediation || h.suggestedRemediation || 'Refactor complex routines.',
  }));

  // 6. Generate Prioritized Investigation Queue (What to fix first)
  const investigationQueue = (priorityFindings.length > 0 ? priorityFindings : normalizedFindings.slice(0, 4)).map(
    (finding, idx) => {
      let priorityBadge = 'Defensive Hygiene';
      if (finding.severity === 'critical') {
        priorityBadge = idx === 0 ? 'Immediate Remediation' : 'High Priority Architectural Risk';
      } else if (finding.severity === 'high') {
        priorityBadge = 'Refactoring Target';
      }

      return {
        order: idx + 1,
        priority: priorityBadge,
        title: finding.title,
        target: `${finding.file} (${finding.lineRange})`,
        category: finding.category,
        impact: finding.maintainabilityImpact,
        estimatedHours: finding.remediationEstimateHours,
        rationale: finding.summary,
        recommendedStep: finding.recommendedRemediation,
        findingsCount: 1,
      };
    }
  );

  // 7. Normalize Architecture Graph (React Flow compatible)
  const rawNodes = Array.isArray(rawArch.nodes) ? rawArch.nodes : [];
  const rawEdges = Array.isArray(rawArch.edges) ? rawArch.edges : [];

  const flowNodes = rawNodes.map((node, idx) => {
    // Lay out nodes in a clean 3-column grid
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const posX = 80 + col * 360;
    const posY = 80 + row * 220;

    const afferent = node.afferent_coupling ?? node.afferentCoupling ?? 0;
    const efferent = node.efferent_coupling ?? node.efferentCoupling ?? 0;
    const complexity = node.complexity ?? 1;

    return {
      id: node.id,
      type: 'moduleNode',
      position: node.position || { x: posX, y: posY },
      data: {
        id: node.id,
        label: node.label || node.id,
        fullPath: node.full_path || node.fullPath || node.label || '',
        full_path: node.full_path || node.fullPath || node.label || '',
        category: node.category || 'Service / Logic',
        role: node.role || node.category || 'Module',
        afferentCoupling: afferent,
        afferent_coupling: afferent,
        efferentCoupling: efferent,
        efferent_coupling: efferent,
        instability: typeof node.instability === 'number' ? node.instability : 0.5,
        loc: node.loc || 0,
        complexity,
        isHotspot: complexity >= 15 || afferent >= 4,
        inCircularCycle: Boolean(node.in_circular_cycle || node.inCircularCycle),
        description: `Python module with ${afferent} incoming callers and ${efferent} outgoing dependencies.`,
      },
    };
  });

  const flowEdges = rawEdges.map((edge) => {
    const isCirc = Boolean(edge.is_circular ?? edge.isCircular ?? false);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: {
        isCircular: isCirc,
        is_circular: isCirc,
        importType: edge.import_type || edge.importType || 'direct',
      },
    };
  });

  const rawMetrics = rawArch.metrics || {};
  const normalizedArchMetrics = {
    totalModules: rawMetrics.total_modules ?? rawMetrics.totalModules ?? flowNodes.length,
    total_modules: rawMetrics.total_modules ?? rawMetrics.totalModules ?? flowNodes.length,
    totalDependencies: rawMetrics.total_dependencies ?? rawMetrics.totalDependencies ?? flowEdges.length,
    total_dependencies: rawMetrics.total_dependencies ?? rawMetrics.totalDependencies ?? flowEdges.length,
    circularCyclesCount: rawMetrics.circular_cycles_count ?? rawMetrics.circularCyclesCount ?? 0,
    circular_cycles_count: rawMetrics.circular_cycles_count ?? rawMetrics.circularCyclesCount ?? 0,
    maxAfferentCoupling: {
      module: rawMetrics.max_afferent_coupling_module || 'Primary Core Module',
      inDegree: rawMetrics.max_afferent_coupling ?? rawMetrics.maxAfferentCoupling ?? 0,
    },
    systemModularityScore: `${rawMetrics.system_modularity_score ?? '80'}%`,
  };

  const normalizedArchitecture = {
    disclaimer: rawArch.disclaimer || 'REAL AST ARCHITECTURE — EXTRACTED FROM PYTHON IMPORT STATEMENTS.',
    metrics: normalizedArchMetrics,
    nodes: flowNodes,
    edges: flowEdges,
  };

  return {
    id: raw.id,
    timestamp: raw.timestamp || normalizedRepository.lastAnalyzed,
    displayTimestamp: normalizedRepository.displayTimestamp,
    repository: normalizedRepository,
    summary: normalizedSummary,
    indicators: normalizedIndicators,
    findings: normalizedFindings,
    priorityFindings,
    hotspots: normalizedHotspots,
    investigationQueue,
    architecture: normalizedArchitecture,
    analysisLimitations: raw.analysis_limitations || raw.analysisLimitations || [],
    analysis_limitations: raw.analysis_limitations || raw.analysisLimitations || [],
  };
}

/**
 * Robust fetch wrapper with timeout, JSON parsing, and unified error handling.
 *
 * @param {string} endpoint - Relative endpoint path (e.g. '/health', '/analyze')
 * @param {RequestInit} [options={}] - Standard Fetch options
 * @param {number} [timeoutMs=60000] - Request timeout in milliseconds
 * @returns {Promise<any>}
 */
async function fetchWithTimeout(endpoint, options = {}, timeoutMs = 60000) {
  const baseUrl = getEffectiveBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Read response text first to handle both JSON and non-JSON error payloads cleanly
    const rawText = await response.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      // Non-JSON response
    }

    if (!response.ok) {
      let errorMessage = 'An error occurred while communicating with the static analysis backend.';
      let errorCode = `HTTP_${response.status}`;
      let detail = null;

      if (data && typeof data === 'object') {
        detail = data.detail || data.error || data.message || data;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Pydantic validation error list
          errorMessage = detail.map((d) => d.msg || `${d.loc?.join('.')}: ${d.type}`).join('; ');
        }
      } else if (rawText) {
        errorMessage = rawText.slice(0, 200);
      }

      if (response.status === 400) {
        errorCode = 'VALIDATION_OR_INGESTION_ERROR';
      } else if (response.status === 404) {
        errorCode = 'NOT_FOUND';
        errorMessage = errorMessage || 'The requested repository or API resource was not found.';
      } else if (response.status === 429) {
        errorCode = 'RATE_LIMITED';
        errorMessage = (typeof detail === 'string' && detail) ? detail : 'Request rate limit reached. Please wait a moment before trying again.';
      } else if (response.status === 503) {
        errorCode = 'SERVICE_UNAVAILABLE';
      } else if (response.status === 504) {
        errorCode = 'GATEWAY_TIMEOUT';
      } else if (response.status >= 500) {
        errorCode = 'ENGINE_SERVER_ERROR';
      }

      throw new ApiError(errorMessage, {
        status: response.status,
        code: errorCode,
        detail,
      });
    }

    if (!data) {
      throw new ApiError('Backend returned an empty response.', {
        status: response.status,
        code: 'EMPTY_RESPONSE',
      });
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new ApiError(
        `Repository analysis timed out after ${Math.round(timeoutMs / 1000)} seconds. Large repositories may exceed timeout thresholds.`,
        {
          status: 504,
          code: 'TIMEOUT',
          originalError: err,
        }
      );
    }

    // Network disconnection / Backend server offline
    const isNetworkError =
      err instanceof TypeError &&
      (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError'));

    if (isNetworkError) {
      throw new ApiError(
        `Static analysis engine backend is unreachable at ${baseUrl}. Ensure the FastAPI server is running with 'uvicorn app.main:app --port 8000'.`,
        {
          status: 503,
          code: 'BACKEND_UNAVAILABLE',
          originalError: err,
        }
      );
    }

    throw new ApiError(err.message || 'Unexpected network communication failure.', {
      status: 0,
      code: 'NETWORK_ERROR',
      originalError: err,
    });
  }
}

/**
 * Public CodeSentinel AI API Client Methods.
 */
export const apiClient = {
  /**
   * Health probe: Checks if the static analysis engine backend is running and healthy.
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<{ status: string, service: string, version: string, supported_languages: string[] }>}
   */
  async checkHealth(timeoutMs = 5000) {
    return fetchWithTimeout('/health', { method: 'GET' }, timeoutMs);
  },

  /**
   * Run real static analysis against a public GitHub repository.
   *
   * @param {string} repositoryUrl - Canonical GitHub HTTPS URL
   * @param {Object} [options={}]
   * @param {number} [options.timeoutMs=75000] - Ingestion + AST analysis timeout
   * @returns {Promise<Object>} Normalized AnalysisResult
   */
  async analyzeRepository(repositoryUrl, { timeoutMs = 75000 } = {}) {
    if (!repositoryUrl || typeof repositoryUrl !== 'string') {
      throw new ApiError('A valid GitHub repository URL is required.', {
        status: 400,
        code: 'INVALID_URL',
      });
    }

    const payload = { repository_url: repositoryUrl.trim() };
    const rawResult = await fetchWithTimeout(
      '/analyze',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    return normalizeAnalysisResult(rawResult);
  },

  /**
   * Retrieve list of historical analysis runs stored in backend SQLite database.
   * @returns {Promise<Array<Object>>}
   */
  async getAnalyses() {
    return fetchWithTimeout('/analyses', { method: 'GET' }, 10000);
  },

  /**
   * Retrieve a specific analysis run by its UUID from backend SQLite database.
   * @param {string} analysisId
   * @returns {Promise<Object>} Normalized AnalysisResult
   */
  async getAnalysisById(analysisId) {
    if (!analysisId) {
      throw new ApiError('Analysis ID is required.', { status: 400, code: 'MISSING_ID' });
    }
    const rawResult = await fetchWithTimeout(`/analyses/${encodeURIComponent(analysisId)}`, { method: 'GET' }, 15000);
    return normalizeAnalysisResult(rawResult);
  },

  /**
   * Delete an analysis run from backend SQLite database.
   * @param {string} analysisId
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async deleteAnalysis(analysisId) {
    if (!analysisId) {
      throw new ApiError('Analysis ID is required.', { status: 400, code: 'MISSING_ID' });
    }
    return fetchWithTimeout(`/analyses/${encodeURIComponent(analysisId)}`, { method: 'DELETE' }, 10000);
  },

  /**
   * Requests a Gemini-powered plain-language explanation and refactoring guidance for a finding.
   *
   * @param {Object} finding - Maintainability finding object
   * @param {Object} [options={}]
   * @param {number} [options.timeoutMs=35000]
   * @returns {Promise<Object>} Normalized explanation object with refactoring guidance
   */
  async explainFinding(finding, { timeoutMs = 35000 } = {}) {
    if (!finding || typeof finding !== 'object') {
      throw new ApiError('Finding data is required to request an AI explanation.', {
        status: 400,
        code: 'INVALID_FINDING',
      });
    }

    const payload = {
      finding_id: finding.id || 'FIND-000',
      rule_id: finding.ruleId || finding.rule_id || 'general/maintainability',
      category: finding.category || 'General Maintainability',
      severity: finding.severity || 'medium',
      file: finding.file || 'unknown_file.py',
      line_range: finding.lineRange || finding.line_range || 'file-level',
      title: finding.title || 'Code maintainability finding',
      summary: finding.summary || finding.title || '',
      detailed_explanation: finding.detailedExplanation || finding.detailed_explanation || '',
      code_snippet: finding.evidence?.codeSnippet || finding.evidence?.code_snippet || '',
      maintainability_impact: finding.maintainabilityImpact || finding.maintainability_impact || '',
      recommended_remediation: finding.recommendedRemediation || finding.recommended_remediation || '',
      evidence: finding.evidence || null,
    };

    const raw = await fetchWithTimeout(
      '/findings/explain',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    return {
      findingId: raw.finding_id,
      finding_id: raw.finding_id,
      ruleId: raw.rule_id,
      rule_id: raw.rule_id,
      file: raw.file,
      lineRange: raw.line_range,
      line_range: raw.line_range,
      plainLanguageExplanation: raw.plain_language_explanation,
      plain_language_explanation: raw.plain_language_explanation,
      whyItMatters: raw.why_it_matters,
      why_it_matters: raw.why_it_matters,
      proposedRemediation: raw.proposed_remediation,
      proposed_remediation: raw.proposed_remediation,
      refactoringExample: raw.refactoring_example,
      refactoring_example: raw.refactoring_example,
      potentialTradeoffs: raw.potential_tradeoffs,
      potential_tradeoffs: raw.potential_tradeoffs,
      architecturalConsiderations: raw.architectural_considerations,
      architectural_considerations: raw.architectural_considerations,
      contextLimitations: raw.context_limitations,
      context_limitations: raw.context_limitations,
      modelName: raw.model_name,
      model_name: raw.model_name,
      generatedAt: raw.generated_at,
      generated_at: raw.generated_at,
      origin: raw.origin || 'AI_EXPLANATION (Gemini)',
    };
  },
};

export default apiClient;
