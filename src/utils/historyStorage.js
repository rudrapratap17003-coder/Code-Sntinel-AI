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
export function isValidHistoryRecord(record) {
  if (!record || typeof record !== 'object') return false;

  // Validate ID and timestamp
  if (typeof record.id !== 'string' || !record.id.trim()) return false;
  if (!record.timestamp && !record.repository?.lastAnalyzed) return false;

  // Validate repository metadata
  if (!record.repository || typeof record.repository !== 'object') return false;
  if (typeof record.repository.name !== 'string' || !record.repository.name.trim()) return false;
  if (typeof record.repository.url !== 'string' || !record.repository.url.trim()) return false;

  // Validate summary & CMDI
  if (!record.summary || typeof record.summary !== 'object') return false;
  if (typeof record.summary.cmdi !== 'number' || isNaN(record.summary.cmdi)) return false;

  // Validate indicators & findings collections
  if (!Array.isArray(record.indicators) || record.indicators.length === 0) return false;
  if (!Array.isArray(record.findings)) return false;

  return true;
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
