import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { DEMO_ANALYSIS } from '../data/demoAnalysis';
import {
  loadHistoryFromStorage,
  saveHistoryToStorage,
  getInitialSeedHistory,
  normalizeBackendSummary,
  mergeHistoryRecords,
} from '../utils/historyStorage';
import { apiClient, ApiError } from '../api';

const AnalysisContext = createContext(null);

export const SIMULATION_STAGES = [
  { step: 1, percent: 25, label: 'Validating GitHub URL format and path authority...' },
  { step: 2, percent: 50, label: 'Connecting to engine: Offline demonstration mode active (no remote clone)...' },
  { step: 3, percent: 75, label: 'Loading deterministic AST complexity and duplication metrics...' },
  { step: 4, percent: 100, label: 'Finalizing maintainability scores and hotspot rankings...' },
];

export const LIVE_STAGES = [
  { step: 1, percent: 15, label: 'Validating repository coordinates and security policy...' },
  { step: 2, percent: 35, label: 'Streaming repository archive & extracting to sandbox...' },
  { step: 3, percent: 65, label: 'Parsing Python AST, computing McCabe complexity & detecting duplication...' },
  { step: 4, percent: 85, label: 'Analyzing import coupling graph, Tarjan SCC cycles & computing CMDI...' },
  { step: 5, percent: 100, label: 'Analysis complete! Finalizing codebase intelligence...' },
];

/**
 * Global Analysis State Provider.
 * Synchronizes repository analysis across all CodeSentinel AI pages.
 */
export function AnalysisProvider({ children }) {
  // Initialize history from localStorage safely
  const [historyData, setHistoryData] = useState(() => loadHistoryFromStorage());
  const historyRecords = historyData.records;
  const corruptedCount = historyData.corruptedCount;

  // Active selected analysis defaults to the latest history record or DEMO_ANALYSIS
  const [currentAnalysis, setCurrentAnalysis] = useState(() => {
    return historyRecords.length > 0 ? historyRecords[0] : DEMO_ANALYSIS;
  });

  const [submittedRepoUrl, setSubmittedRepoUrl] = useState(() => {
    return currentAnalysis?.repository?.url || DEMO_ANALYSIS.repository.url;
  });

  const [activeFinding, setActiveFinding] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisMode, setAnalysisMode] = useState('live'); // 'live' | 'demo'
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [backendMeta, setBackendMeta] = useState(null);

  // History synchronization states
  const [historyError, setHistoryError] = useState(null);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  const simulationTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const isSyncingRef = useRef(false);

  // Helper to persist history changes
  const updateHistory = useCallback((newRecords) => {
    setHistoryData((prev) => ({ ...prev, records: newRecords }));
    saveHistoryToStorage(newRecords);
  }, []);

  /**
   * Synchronizes analysis history from the backend SQLite database when online in live mode.
   * Merges backend records with local storage without introducing duplicates or dropping local data.
   */
  const syncBackendHistory = useCallback(async () => {
    if (!mountedRef.current) return;
    if (isSyncingRef.current) return;
    if (analysisMode !== 'live' || backendStatus !== 'online') return;

    isSyncingRef.current = true;
    setIsSyncingHistory(true);
    setHistoryError(null);

    try {
      const backendSummaries = await apiClient.getAnalyses();
      if (!mountedRef.current) return;

      if (Array.isArray(backendSummaries)) {
        setHistoryData((prev) => {
          const merged = mergeHistoryRecords(prev.records, backendSummaries);
          saveHistoryToStorage(merged);
          return { ...prev, records: merged };
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const errorMsg =
        err instanceof ApiError
          ? err.message
          : `Failed to synchronize analysis history with database: ${err.message}`;
      console.warn('[CodeSentinel AI] History sync warning:', errorMsg);
      setHistoryError(errorMsg);
    } finally {
      isSyncingRef.current = false;
      if (mountedRef.current) {
        setIsSyncingHistory(false);
      }
    }
  }, [analysisMode, backendStatus]);

  /**
   * Probes the Python static analysis engine backend health.
   */
  const checkBackendStatus = useCallback(async () => {
    try {
      setBackendStatus('checking');
      const health = await apiClient.checkHealth(4000);
      if (health && health.status === 'healthy') {
        if (mountedRef.current) {
          setBackendStatus('online');
          setBackendMeta(health);
        }
        return true;
      }
      if (mountedRef.current) {
        setBackendStatus('offline');
      }
      return false;
    } catch {
      if (mountedRef.current) {
        setBackendStatus('offline');
      }
      return false;
    }
  }, []);

  // Track mounted ref and cleanup timers
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, []);

  // Probe backend on mount
  useEffect(() => {
    checkBackendStatus();
  }, [checkBackendStatus]);

  // Synchronize backend history when live mode is active and backend is online
  useEffect(() => {
    if (backendStatus === 'online' && analysisMode === 'live') {
      syncBackendHistory();
    }
  }, [backendStatus, analysisMode, syncBackendHistory]);

  /**
   * Run real static analysis through the FastAPI backend engine.
   * On failure, never silently substitutes demo data; records the error and permits retry.
   *
   * @param {Object} validatedRepo
   * @param {Object} [callbacks]
   * @param {Function} [callbacks.onSuccess]
   * @param {Function} [callbacks.onError]
   */
  const runLiveAnalysis = async (validatedRepo, { onSuccess, onError } = {}) => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSubmittedRepoUrl(validatedRepo.normalizedUrl);

    let currentStep = 0;
    setAnalysisStage(LIVE_STAGES[0]);

    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
    }

    // Step through progression stages while waiting for backend static engine
    simulationTimerRef.current = setInterval(() => {
      currentStep += 1;
      if (currentStep < LIVE_STAGES.length - 1) {
        setAnalysisStage(LIVE_STAGES[currentStep]);
      }
    }, 1100);

    try {
      const normalizedResult = await apiClient.analyzeRepository(validatedRepo.normalizedUrl);

      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      setAnalysisStage(LIVE_STAGES[LIVE_STAGES.length - 1]);

      setCurrentAnalysis(normalizedResult);

      // Prepend to history & save
      const newHistory = [
        normalizedResult,
        ...historyRecords.filter(
          (r) => r.id !== normalizedResult.id && r.repository?.url !== validatedRepo.normalizedUrl
        ),
      ];
      updateHistory(newHistory);

      setIsAnalyzing(false);
      setAnalysisStage(null);

      if (onSuccess) {
        onSuccess(normalizedResult);
      }
      return normalizedResult;
    } catch (err) {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      setIsAnalyzing(false);
      setAnalysisStage(null);

      const structuredError =
        err instanceof ApiError
          ? err
          : new ApiError(err.message || 'Unexpected failure during repository analysis.', {
              code: 'ANALYSIS_FAILED',
              originalError: err,
            });

      setAnalysisError(structuredError);

      if (onError) {
        onError(structuredError);
      }
      throw structuredError;
    }
  };

  /**
   * Run the deterministic demo analysis sequence for a validated GitHub repository.
   * Persists the finished run to history and makes it the active analysis.
   */
  const runDemoAnalysis = (validatedRepo, onComplete) => {
    if (isAnalyzing) return; // Prevent multiple concurrent submissions

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSubmittedRepoUrl(validatedRepo.normalizedUrl);

    let currentStep = 0;
    setAnalysisStage(SIMULATION_STAGES[0]);

    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
    }

    simulationTimerRef.current = setInterval(() => {
      currentStep += 1;
      if (currentStep < SIMULATION_STAGES.length) {
        setAnalysisStage(SIMULATION_STAGES[currentStep]);
      } else {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;

        const timestampIso = new Date().toISOString();
        const displayTimestamp = 'Just now • Demo Mode';

        // Construct coherent deterministic analysis tied to the submitted URL
        const updatedAnalysis = {
          ...DEMO_ANALYSIS,
          id: `analysis-run-${Date.now()}`,
          timestamp: timestampIso,
          displayTimestamp,
          repository: {
            ...DEMO_ANALYSIS.repository,
            name: validatedRepo.fullName,
            url: validatedRepo.normalizedUrl,
            lastAnalyzed: timestampIso,
            displayTimestamp,
            isDemo: true,
            is_demo: true,
            modeLabel: 'DEMO ANALYSIS',
            mode_label: 'DEMO ANALYSIS',
          },
        };

        // Update active selection
        setCurrentAnalysis(updatedAnalysis);

        // Prepend to history & save
        const newHistory = [
          updatedAnalysis,
          ...historyRecords.filter((r) => r.repository.url !== validatedRepo.normalizedUrl),
        ];
        updateHistory(newHistory);

        setIsAnalyzing(false);
        setAnalysisStage(null);

        if (onComplete) {
          onComplete(updatedAnalysis);
        }
      }
    }, 450);
  };

  /**
   * Restores a previously saved historical analysis into active application state.
   * If the record is summary-only, retrieves the complete report from the backend.
   * Handles network and retrieval failures gracefully without setting broken state.
   */
  const restoreAnalysis = async (record) => {
    if (!record) return null;
    setHistoryError(null);

    const needsFullFetch =
      record.isSummaryOnly ||
      !Array.isArray(record.findings) ||
      !record.architecture;

    if (needsFullFetch) {
      if (backendStatus !== 'online') {
        const msg = `Backend engine is offline. Cannot retrieve full analysis report for "${record.repository?.name || record.id}".`;
        setHistoryError(msg);
        return null;
      }

      setIsRestoring(true);
      setRestoringId(record.id);

      try {
        const fullReport = await apiClient.getAnalysisById(record.id);
        if (!mountedRef.current) return null;

        // Upgrade this record in history state & localStorage so future restores are instant
        setHistoryData((prev) => {
          const updated = prev.records.map((r) => (r.id === record.id ? fullReport : r));
          saveHistoryToStorage(updated);
          return { ...prev, records: updated };
        });

        setCurrentAnalysis(fullReport);
        if (fullReport?.repository?.url) {
          setSubmittedRepoUrl(fullReport.repository.url);
        }
        return fullReport;
      } catch (err) {
        if (!mountedRef.current) return null;
        const errorMsg =
          err instanceof ApiError
            ? err.message
            : `Failed to retrieve complete report for "${record.repository?.name || record.id}": ${err.message}`;
        console.error('[CodeSentinel AI] Restore full report error:', err);
        setHistoryError(errorMsg);
        return null;
      } finally {
        if (mountedRef.current) {
          setIsRestoring(false);
          setRestoringId(null);
        }
      }
    }

    // Already a complete analysis report (demo record or locally cached full report)
    setCurrentAnalysis(record);
    if (record?.repository?.url) {
      setSubmittedRepoUrl(record.repository.url);
    }
    return record;
  };

  /**
   * Deletes a single history record.
   * When in live mode and backend is online, synchronizes deletion with backend SQLite via apiClient.deleteAnalysis(id).
   * Displays or logs failures without pretending that server deletion succeeded.
   */
  const deleteHistoryRecord = async (id) => {
    if (!id) return false;
    setHistoryError(null);

    const targetRecord = historyRecords.find((r) => r.id === id);
    const isBackendRecord =
      targetRecord &&
      !targetRecord.repository?.isDemo &&
      !id.startsWith('analysis-seed-');

    if (isBackendRecord && backendStatus === 'online' && analysisMode === 'live') {
      try {
        await apiClient.deleteAnalysis(id);
      } catch (err) {
        // If the record was already deleted on the server (404), allow local cleanup to proceed
        if (err?.status !== 404) {
          const errorMsg =
            err instanceof ApiError
              ? err.message
              : `Failed to delete record ${id} from server: ${err.message}`;
          console.error('[CodeSentinel AI] Failed to delete analysis from backend:', err);
          setHistoryError(errorMsg);
          // Do not silently pretend server deletion succeeded:
          // Do not remove it locally if server deletion failed!
          return false;
        }
      }
    }

    // Server deletion succeeded or it was a local demo record: remove locally
    setHistoryData((prev) => {
      const updated = prev.records.filter((r) => r.id !== id);
      saveHistoryToStorage(updated);
      return { ...prev, records: updated };
    });

    // If the active analysis was deleted, switch to the first available full analysis, restore, or null
    if (currentAnalysis?.id === id) {
      const updated = historyRecords.filter((r) => r.id !== id);
      if (updated.length > 0) {
        const nextFull = updated.find(
          (r) => !r.isSummaryOnly && Array.isArray(r.findings) && r.architecture
        );
        if (nextFull) {
          setCurrentAnalysis(nextFull);
          setSubmittedRepoUrl(nextFull.repository?.url || '');
        } else {
          // If the next available record is summary-only, restore it asynchronously
          restoreAnalysis(updated[0]);
        }
      } else {
        setCurrentAnalysis(null);
      }
    }

    return true;
  };

  /**
   * Clears stored local history from browser localStorage.
   * Never deletes backend records as part of bulk localStorage cleanup (Requirement 8).
   */
  const clearAllHistory = () => {
    updateHistory([]);
    setCurrentAnalysis(null);
    setHistoryError(null);
  };

  /**
   * Resets to initial demo seed.
   */
  const resetToSeedHistory = () => {
    const seed = getInitialSeedHistory();
    updateHistory(seed);
    setCurrentAnalysis(seed[0]);
    setSubmittedRepoUrl(seed[0].repository.url);
  };

  const loadDemoAnalysis = () => {
    setCurrentAnalysis(DEMO_ANALYSIS);
    setSubmittedRepoUrl(DEMO_ANALYSIS.repository.url);
  };

  const clearAnalysis = () => {
    setCurrentAnalysis(null);
  };

  const clearAnalysisError = () => {
    setAnalysisError(null);
  };

  const selectFinding = (finding) => {
    setActiveFinding(finding);
  };

  const clearActiveFinding = () => {
    setActiveFinding(null);
  };

  const value = {
    currentAnalysis,
    historyRecords,
    corruptedCount,
    submittedRepoUrl,
    setSubmittedRepoUrl,
    isDemoMode: Boolean(currentAnalysis?.repository?.isDemo),
    isAnalyzing,
    analysisStage,
    analysisError,
    clearAnalysisError,
    analysisMode,
    setAnalysisMode,
    backendStatus,
    backendMeta,
    checkBackendStatus,
    activeFinding,
    runLiveAnalysis,
    runDemoAnalysis,
    restoreAnalysis,
    deleteHistoryRecord,
    clearAllHistory,
    resetToSeedHistory,
    loadDemoAnalysis,
    clearAnalysis,
    selectFinding,
    clearActiveFinding,
    // History synchronization additions
    historyError,
    clearHistoryError: () => setHistoryError(null),
    isSyncingHistory,
    syncBackendHistory,
    isRestoring,
    restoringId,
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}

export default AnalysisContext;
