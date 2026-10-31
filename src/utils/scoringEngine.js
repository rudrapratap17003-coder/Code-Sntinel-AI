/**
 * CodeSentinel AI — Technical Debt Scoring Engine.
 *
 * Implements the Code Maintainability Debt Index (CMDI).
 *
 * NOTE: CMDI is an internal CodeSentinel AI maintainability indicator, NOT
 * an established universal industry standard. The weightings and thresholds
 * defined herein are initial product heuristics and have not been scientifically validated.
 */

export const CMDI_TIERS = [
  {
    tier: 'low',
    min: 0,
    max: 25,
    label: 'Low Risk',
    variant: 'success',
    color: '#00F5A0',
    description: 'Codebase exhibits low branching complexity, minimal duplication, and clean module boundaries.',
  },
  {
    tier: 'moderate',
    min: 26,
    max: 50,
    label: 'Moderate Risk',
    variant: 'info',
    color: '#55C7E8',
    description: 'Acceptable structural maintainability with localized complexity hotspots requiring observation.',
  },
  {
    tier: 'high',
    min: 51,
    max: 75,
    label: 'High Risk',
    variant: 'medium',
    color: '#F5B942',
    description: 'Significant technical debt present. High cyclomatic complexity and coupling impede velocity and increase defect risk.',
  },
  {
    tier: 'critical',
    min: 76,
    max: 100,
    label: 'Critical Risk',
    variant: 'critical',
    color: '#FF5D68',
    description: 'Severe structural debt. Widespread circular dependencies, god-objects, and unmaintainable logic loops threaten system stability.',
  },
];

export const INDICATOR_WEIGHTS = {
  complexity: 0.25,
  duplication: 0.25,
  coupling: 0.25,
  error_handling: 0.25,
};

/**
 * Resolves the qualitative risk tier for a given numerical CMDI score.
 * @param {number} score - CMDI value between 0 and 100
 * @returns {typeof CMDI_TIERS[number]}
 */
export function getCmdiTier(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return {
      tier: 'unknown',
      id: 'unknown',
      min: 0,
      max: 100,
      label: 'Not Available',
      variant: 'default',
      color: '#9BAAA1',
      description: 'Insufficient metric data to compute maintainability tier.',
    };
  }

  const clamped = Math.max(0, Math.min(100, score));

  if (clamped <= 25) return CMDI_TIERS[0];
  if (clamped <= 50) return CMDI_TIERS[1];
  if (clamped <= 75) return CMDI_TIERS[2];
  return CMDI_TIERS[3];
}

/**
 * Normalizes raw metrics into standardized risk sub-scores on a 0–100 scale.
 * Higher normalized sub-score = greater maintainability concern.
 *
 * @param {Object} rawInputs
 * @param {number|null} [rawInputs.maxComplexity] - Highest function McCabe cyclomatic complexity
 * @param {number|null} [rawInputs.duplicationPercent] - Duplicate code percentage (0 - 100)
 * @param {number|null} [rawInputs.couplingFactor] - Afferent/efferent coupling coefficient (0.0 - 1.0)
 * @param {number|null} [rawInputs.errorConsistencyScore] - Error handling adherence rating (0 - 100)
 * @returns {{
 *   complexityRisk: number|null,
 *   duplicationRisk: number|null,
 *   couplingRisk: number|null,
 *   errorHandlingRisk: number|null
 * }}
 */
export function normalizeIndicatorRisks(rawInputs = {}) {
  // 1. Complexity Normalization:
  // McCabe <= 10 is healthy (0 risk). McCabe >= 40 represents max risk (100).
  let complexityRisk = null;
  if (typeof rawInputs.maxComplexity === 'number' && !isNaN(rawInputs.maxComplexity)) {
    complexityRisk = Math.min(100, Math.max(0, Math.round(((rawInputs.maxComplexity - 10) / 30) * 100 * 10) / 10));
  }

  // 2. Duplication Normalization:
  // 0% duplication = 0 risk. >= 25% duplication = 100 risk.
  let duplicationRisk = null;
  if (typeof rawInputs.duplicationPercent === 'number' && !isNaN(rawInputs.duplicationPercent)) {
    duplicationRisk = Math.min(100, Math.max(0, Math.round((rawInputs.duplicationPercent / 25) * 100 * 10) / 10));
  }

  // 3. Coupling Normalization:
  // Coupling factor 0.0 to 1.0 mapped directly to 0 to 100.
  let couplingRisk = null;
  if (typeof rawInputs.couplingFactor === 'number' && !isNaN(rawInputs.couplingFactor)) {
    couplingRisk = Math.min(100, Math.max(0, Math.round(rawInputs.couplingFactor * 100 * 10) / 10));
  }

  // 4. Error-Handling Risk Normalization:
  // Consistency score 100 = 0 risk. Consistency score 0 = 100 risk.
  let errorHandlingRisk = null;
  if (typeof rawInputs.errorConsistencyScore === 'number' && !isNaN(rawInputs.errorConsistencyScore)) {
    errorHandlingRisk = Math.min(100, Math.max(0, Math.round((100 - rawInputs.errorConsistencyScore) * 10) / 10));
  }

  return {
    complexityRisk,
    duplicationRisk,
    couplingRisk,
    errorHandlingRisk,
  };
}

/**
 * Calculates the Code Maintainability Debt Index (CMDI) from normalized indicator risks.
 * Formula: CMDI = sum(w_i * R_i) / sum(w_i for available metrics).
 *
 * Handles missing or unsupported metrics safely by re-weighting across available indicators.
 *
 * @param {Object} normalizedRisks
 * @param {number|null} [normalizedRisks.complexityRisk]
 * @param {number|null} [normalizedRisks.duplicationRisk]
 * @param {number|null} [normalizedRisks.couplingRisk]
 * @param {number|null} [normalizedRisks.errorHandlingRisk]
 * @param {Object} [weights=INDICATOR_WEIGHTS]
 * @returns {{
 *   cmdi: number|null,
 *   tier: typeof CMDI_TIERS[number],
 *   contributions: {
 *     complexity: { risk: number|null, contribution: number|null, weight: number },
 *     duplication: { risk: number|null, contribution: number|null, weight: number },
 *     coupling: { risk: number|null, contribution: number|null, weight: number },
 *     error_handling: { risk: number|null, contribution: number|null, weight: number }
 *   },
 *   availableIndicatorsCount: number
 * }}
 */
export function calculateCMDI(normalizedRisks = {}, weights = INDICATOR_WEIGHTS) {
  const entries = [
    { key: 'complexity', risk: normalizedRisks.complexityRisk, weight: weights.complexity },
    { key: 'duplication', risk: normalizedRisks.duplicationRisk, weight: weights.duplication },
    { key: 'coupling', risk: normalizedRisks.couplingRisk, weight: weights.coupling },
    { key: 'error_handling', risk: normalizedRisks.errorHandlingRisk, weight: weights.error_handling },
  ];

  const available = entries.filter((e) => typeof e.risk === 'number' && !isNaN(e.risk));

  if (available.length === 0) {
    return {
      cmdi: null,
      tier: getCmdiTier(null),
      contributions: {
        complexity: { risk: null, contribution: null, weight: weights.complexity },
        duplication: { risk: null, contribution: null, weight: weights.duplication },
        coupling: { risk: null, contribution: null, weight: weights.coupling },
        error_handling: { risk: null, contribution: null, weight: weights.error_handling },
      },
      availableIndicatorsCount: 0,
    };
  }

  // Calculate sum of active weights to support partial metric sets gracefully
  const totalWeight = available.reduce((acc, curr) => acc + curr.weight, 0);

  let weightedSum = 0;
  const contributions = {};

  entries.forEach((entry) => {
    if (typeof entry.risk === 'number' && !isNaN(entry.risk)) {
      // Adjusted normalized contribution
      const effectiveWeight = entry.weight / totalWeight;
      const contribution = Math.round(entry.risk * effectiveWeight * 10) / 10;
      weightedSum += entry.risk * effectiveWeight;
      contributions[entry.key] = {
        risk: entry.risk,
        contribution,
        weight: effectiveWeight,
      };
    } else {
      contributions[entry.key] = {
        risk: null,
        contribution: null,
        weight: 0,
      };
    }
  });

  const cmdi = Math.round(weightedSum * 10) / 10;
  const tier = getCmdiTier(cmdi);

  return {
    cmdi,
    tier,
    contributions,
    availableIndicatorsCount: available.length,
  };
}
