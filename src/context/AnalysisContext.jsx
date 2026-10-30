import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { DEMO_ANALYSIS } from '../data/demoAnalysis';
import {
  loadHistoryFromStorage,
  saveHistoryToStorage,
  getInitialSeedHistory,
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

  const simulationTimerRef = useRef(null);

  // Helper to persist history changes
  const updateHistory = (newRecords) => {
    setHistoryData((prev) => ({ ...prev, records: newRecords }));
    saveHistoryToStorage(newRecords);
  };

  /**
   * Probes the Python static analysis engine backend health.
   */
  const checkBackendStatus = useCallback(async () => {
    try {
      setBackendStatus('checking');
      const health = await apiClient.checkHealth(4000);
      if (health && health.status === 'healthy') {
        setBackendStatus('online');
        setBackendMeta(health);
        return true;
      }
      setBackendStatus('offline');
      return false;
    } catch {
      setBackendStatus('offline');
      return false;
    }
  }, []);

  // Probe backend on mount
  useEffect(() => {
    checkBackendStatus();
    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [checkBackendStatus]);

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
   */
  const restoreAnalysis = (record) => {
    setCurrentAnalysis(record);
    if (record?.repository?.url) {
      setSubmittedRepoUrl(record.repository.url);
    }
  };

  /**
   * Deletes a single history record.
   */
  const deleteHistoryRecord = (id) => {
    const updated = historyRecords.filter((r) => r.id !== id);
    updateHistory(updated);

    // If the active analysis was deleted, switch to the first available or null
    if (currentAnalysis?.id === id) {
      if (updated.length > 0) {
        setCurrentAnalysis(updated[0]);
        setSubmittedRepoUrl(updated[0].repository.url);
      } else {
        setCurrentAnalysis(null);
      }
    }
  };

  /**
   * Clears all stored history.
   */
  const clearAllHistory = () => {
    updateHistory([]);
    setCurrentAnalysis(null);
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
