/**
 * CodeSentinel AI — History Persistence & Validation Storage.
 *
 * Uses localStorage with schema validation, sanitization, and graceful recovery.
 * Never stores tokens, passwords, or secrets.
 */

import { DEMO_ANALYSIS } from '../data/demoAnalysis.js';

export const HISTORY_STORAGE_KEY = 'codesentinel_analysis_history_v1';

/**
 * Validates whether a history record conforms to the required CodeSentinel analysis contract.
 * @param {any} record
 * @returns {boolean}
 */
/**
 * Validates whether a history record conforms to the required CodeSentinel analysis contract.
 * @param {any} record
 * @returns {boolean}
 */
export function isValidHistoryRecord(record) {
  if (!record || typeof record !== 'object') return false;

  // Validate ID and timestamp
  if (typeof record.id !== 'string' || !record.id.trim()) return false;
  if (!record.timestamp && !record.repository?.lastAnalyzed) return false;

  // Validate repository metadata
  if (!record.repository || typeof record.repository !== 'object') return false;
  if (typeof record.repository.name !== 'string' || !record.repository.name.trim()) return false;
  if (typeof record.repository.url !== 'string' || !record.repository.url.trim()) return false;

  // Validate summary & CMDI (allows explicit null for Not Available states)
  if (!record.summary || typeof record.summary !== 'object') return false;
  const cmdiVal = record.summary.cmdi;
  if (cmdiVal !== null && (typeof cmdiVal !== 'number' || isNaN(cmdiVal))) return false;

  // Summary-only backend records are valid without indicators and findings collections
  if (record.isSummaryOnly) {
    return true;
  }

  // Validate indicators & findings collections for full analysis records
  if (!Array.isArray(record.indicators) || record.indicators.length === 0) return false;
  if (!Array.isArray(record.findings)) return false;

  return true;
}

/**
 * Normalizes a flat backend analysis summary (from GET /api/v1/analyses) into the
 * nested record contract expected by HistoryPage and AnalysisContext.
 * Handles both snake_case and camelCase fields without inventing findings,
 * hotspots, or architecture data.
 *
 * @param {Object} item
 * @returns {Object|null}
 */
export function normalizeBackendSummary(item) {
  if (!item || typeof item !== 'object') return null;

  const id = item.id;
  if (!id || typeof id !== 'string' || !id.trim()) return null;

  const timestamp = item.timestamp || new Date().toISOString();
  const displayTimestamp = item.display_timestamp || item.displayTimestamp || 'Timestamp unavailable';
  const repoName = item.repository_name || item.repositoryName || 'Unknown Repository';
  const repoUrl = item.repository_url || item.repositoryUrl || '';
  const cmdi = typeof item.cmdi === 'number' ? item.cmdi : 0;
  const riskCategory = item.risk_category || item.riskCategory || 'Low Risk';
  const findingsCount = typeof item.findings_count === 'number' ? item.findings_count : (item.findingsCount || 0);
  const filesExamined = typeof item.files_examined === 'number' ? item.files_examined : (item.filesExamined || 0);
  const linesOfCode = typeof item.lines_of_code === 'number' ? item.lines_of_code : (item.linesOfCode || 0);
  const branch = item.branch || 'main';
  const commitHash = item.commit_hash || item.commitHash || 'HEAD';

  // Compute standard risk severity token from category or CMDI
  let riskSeverity = 'info';
  const catLower = riskCategory.toLowerCase();
  if (catLower.includes('critical') || cmdi > 75) {
    riskSeverity = 'critical';
  } else if (catLower.includes('high') || cmdi > 50) {
    riskSeverity = 'medium';
  } else if (catLower.includes('low') || cmdi <= 25) {
    riskSeverity = 'success';
  }

  return {
    id,
    timestamp,
    displayTimestamp,
    display_timestamp: displayTimestamp,
    repository: {
      name: repoName,
      url: repoUrl,
      branch,
      commitHash,
      commit_hash: commitHash,
      filesExamined,
      files_examined: filesExamined,
      findingsCount,
      findings_count: findingsCount,
      linesOfCode,
      lines_of_code: linesOfCode,
      status: 'Analyzed',
      isDemo: false,
      is_demo: false,
      modeLabel: 'REAL PYTHON STATIC ANALYSIS',
      mode_label: 'REAL PYTHON STATIC ANALYSIS',
    },
    summary: {
      cmdi,
      riskCategory,
      risk_category: riskCategory,
      riskSeverity,
      risk_severity: riskSeverity,
      interpretation: item.interpretation || 'Maintainability assessment computed from Python AST analysis.',
      scoringDisclaimer: 'The Code Maintainability Debt Index (CMDI) is a CodeSentinel AI metric, not an established universal industry standard.',
      remediationEstimateHours: item.remediation_estimate_hours || item.remediationEstimateHours || (findingsCount * 3 + 4),
    },
    // Explicit indicator that full findings/architecture details require GET /api/v1/analyses/{id}
    isSummaryOnly: true,
    is_summary_only: true,
  };
}

/**
 * Merges local storage records with backend analysis summaries without introducing duplicates.
 * Precedence Rule: If a record with the same ID exists locally with full report details
 * (!isSummaryOnly and has findings array), the full local report is preserved over the summary-only backend item.
 *
 * @param {Array<Object>} localRecords
 * @param {Array<Object>} backendSummaries
 * @returns {Array<Object>}
 */
export function mergeHistoryRecords(localRecords = [], backendSummaries = []) {
  const mergedMap = new Map();

  // 1. Index local records
  if (Array.isArray(localRecords)) {
    for (const record of localRecords) {
      if (record && record.id) {
        mergedMap.set(record.id, record);
      }
    }
  }

  // 2. Merge backend summaries
  if (Array.isArray(backendSummaries)) {
    for (const rawItem of backendSummaries) {
      const normalized = normalizeBackendSummary(rawItem);
      if (!normalized) continue;

      const existing = mergedMap.get(normalized.id);
      if (!existing) {
        // New entry from backend
        mergedMap.set(normalized.id, normalized);
      } else {
        // Precedence: Keep full report if existing is already complete
        const isExistingFull =
          !existing.isSummaryOnly &&
          Array.isArray(existing.findings) &&
          existing.architecture;

        if (isExistingFull) {
          mergedMap.set(normalized.id, existing);
        } else {
          mergedMap.set(normalized.id, normalized);
        }
      }
    }
  }

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => {
    const timeA = new Date(a.timestamp || a.repository?.lastAnalyzed || 0).getTime();
    const timeB = new Date(b.timestamp || b.repository?.lastAnalyzed || 0).getTime();
    return timeB - timeA;
  });

  return result;
}

/**
 * Creates seed demonstration history entries if none exist.
 * @returns {Array<Object>}
 */
export function getInitialSeedHistory() {
  const seed1 = {
    ...DEMO_ANALYSIS,
    id: 'analysis-seed-001',
    timestamp: '2026-10-25T20:30:00Z',
    displayTimestamp: 'Oct 25, 2026 • 20:30 UTC',
    repository: {
      ...DEMO_ANALYSIS.repository,
      name: 'codesentinel/orchestrator-core',
      url: 'https://github.com/codesentinel/orchestrator-core',
      branch: 'main',
      commitHash: '7a8b3f1',
      isDemo: true,
      modeLabel: 'DEMO ANALYSIS',
    },
    summary: {
      ...DEMO_ANALYSIS.summary,
      cmdi: 64.5,
      riskCategory: 'High Risk',
    },
  };

  const seed2 = {
    ...DEMO_ANALYSIS,
    id: 'analysis-seed-002',
    timestamp: '2026-10-24T14:15:00Z',
    displayTimestamp: 'Oct 24, 2026 • 14:15 UTC',
    repository: {
      ...DEMO_ANALYSIS.repository,
      name: 'facebook/react',
      url: 'https://github.com/facebook/react',
      branch: 'main',
      commitHash: '4e2d19a',
      isDemo: true,
      modeLabel: 'DEMO ANALYSIS',
      filesExamined: 148,
      findingsCount: 18,
    },
    summary: {
      ...DEMO_ANALYSIS.summary,
      cmdi: 58.0,
      riskCategory: 'High Risk',
      remediationEstimateHours: 110,
    },
  };

  return [seed1, seed2];
}

/**
 * Loads and validates history from browser localStorage.
 * Safely handles corrupted JSON and invalid schema records without throwing.
 * @returns {{ records: Array<Object>, corruptedCount: number }}
 */
export function loadHistoryFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    const seed = getInitialSeedHistory();
    return { records: seed, corruptedCount: 0 };
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      // First run: seed initial demonstration runs
      const seed = getInitialSeedHistory();
      saveHistoryToStorage(seed);
      return { records: seed, corruptedCount: 0 };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[CodeSentinel AI] History storage payload is not an array. Resetting.');
      const seed = getInitialSeedHistory();
      saveHistoryToStorage(seed);
      return { records: seed, corruptedCount: 1 };
    }

    let corruptedCount = 0;
    const validated = [];

    parsed.forEach((item) => {
      if (isValidHistoryRecord(item)) {
        validated.push(item);
      } else {
        corruptedCount += 1;
      }
    });

    return { records: validated, corruptedCount };
  } catch (err) {
    console.error('[CodeSentinel AI] Failed to parse history localStorage. Gracefully recovering:', err);
    return { records: getInitialSeedHistory(), corruptedCount: 1 };
  }
}

/**
 * Saves validated records to localStorage.
 * Strips any potential sensitive properties.
 * @param {Array<Object>} records
 */
export function saveHistoryToStorage(records) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const sanitized = records.map((r) => {
      // Create a clean sanitized copy
      const copy = { ...r };
      delete copy.token;
      delete copy.password;
      delete copy.apiKey;
      delete copy.secret;
      return copy;
    });

    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.error('[CodeSentinel AI] Failed to persist history to localStorage:', err);
  }
}
