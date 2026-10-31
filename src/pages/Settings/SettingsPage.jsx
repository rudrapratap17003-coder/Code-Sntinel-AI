import React, { useState, useEffect } from 'react';
import { Settings, Save, Check, RotateCcw, Cpu, Sparkles, ShieldCheck } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Input,
  Button,
  Badge,
  ErrorMessage,
} from '../../ui';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAnalysis } from '../../context/AnalysisContext';

const SETTINGS_STORAGE_KEY = 'codesentinel_settings';
const DEFAULT_SETTINGS = {
  complexityThreshold: '15',
  duplicationLines: '30',
  couplingThreshold: '12',
};

export function SettingsPage() {
  useDocumentTitle('Settings');
  const { analysisMode, backendStatus } = useAnalysis();

  const [complexityThreshold, setComplexityThreshold] = useState(DEFAULT_SETTINGS.complexityThreshold);
  const [duplicationLines, setDuplicationLines] = useState(DEFAULT_SETTINGS.duplicationLines);
  const [couplingThreshold, setCouplingThreshold] = useState(DEFAULT_SETTINGS.couplingThreshold);
  const [isSaved, setIsSaved] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Load persisted settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.complexityThreshold) setComplexityThreshold(String(parsed.complexityThreshold));
        if (parsed.duplicationLines) setDuplicationLines(String(parsed.duplicationLines));
        if (parsed.couplingThreshold) setCouplingThreshold(String(parsed.couplingThreshold));
      }
    } catch {
      // Fallback to defaults on parse failure
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setValidationError('');

    const cVal = parseInt(complexityThreshold, 10);
    const dVal = parseInt(duplicationLines, 10);
    const coupVal = parseInt(couplingThreshold, 10);

    if (isNaN(cVal) || cVal < 1 || isNaN(dVal) || dVal < 1 || isNaN(coupVal) || coupVal < 1) {
      setValidationError('All threshold settings must be positive integers greater than zero.');
      return;
    }

    try {
      const payload = {
        complexityThreshold: cVal,
        duplicationLines: dVal,
        couplingThreshold: coupVal,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      setValidationError('Failed to save settings to browser local storage.');
    }
  };

  const handleReset = () => {
    setComplexityThreshold(DEFAULT_SETTINGS.complexityThreshold);
    setDuplicationLines(DEFAULT_SETTINGS.duplicationLines);
    setCouplingThreshold(DEFAULT_SETTINGS.couplingThreshold);
    setValidationError('');
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings & Thresholds"
        icon={<Settings size={24} />}
        description="Fine-tune technical debt thresholds, static analysis severity cutoffs, and quality gate boundaries."
        actions={
          <Badge variant="demo">CONFIG DEFAULTS</Badge>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-lg)' }}>
        <Card>
          <CardHeader
            title="Analysis Sensitivity Thresholds"
            subtitle="Configure what constitutes an actionable maintainability violation"
          />
          <CardBody>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {validationError && (
                <ErrorMessage severity="critical" title="Invalid Configuration">
                  {validationError}
                </ErrorMessage>
              )}

              <Input
                label="Cyclomatic Complexity Threshold (McCabe)"
                type="number"
                min="1"
                value={complexityThreshold}
                onChange={(e) => {
                  setComplexityThreshold(e.target.value);
                  if (validationError) setValidationError('');
                }}
                hint="Functions scoring above this limit are flagged as maintainability risks (standard default: 15)."
              />

              <Input
                label="Minimum Duplication Block Size (Lines)"
                type="number"
                min="1"
                value={duplicationLines}
                onChange={(e) => {
                  setDuplicationLines(e.target.value);
                  if (validationError) setValidationError('');
                }}
                hint="Identical or near-identical syntax blocks longer than this will trigger a duplication finding."
              />

              <Input
                label="Architectural In-Degree Coupling Warning"
                type="number"
                min="1"
                value={couplingThreshold}
                onChange={(e) => {
                  setCouplingThreshold(e.target.value);
                  if (validationError) setValidationError('');
                }}
                hint="Modules imported by more than this number of dependents trigger a god-object blast radius warning."
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <Button type="submit" variant="primary" icon={<Save size={15} />}>
                  Save Configuration
                </Button>
                <Button type="button" variant="secondary" onClick={handleReset} icon={<RotateCcw size={14} />}>
                  Reset Defaults
                </Button>
                {isSaved && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Saved locally
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card elevated>
          <CardHeader
            title="Analysis Engine Provenance"
            subtitle="Mode configuration and diagnostic engine telemetry"
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              <div>
                <strong>Active Engine Mode:</strong>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={analysisMode === 'live' ? 'success' : 'demo'}>
                    {analysisMode === 'live' ? 'REAL STATIC ENGINE' : 'DEMONSTRATION MODE'}
                  </Badge>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {analysisMode === 'live'
                    ? 'Connected to FastAPI backend running live Python AST parsing, Radon cyclomatic complexity, and Tarjan SCC cycles.'
                    : 'Runs deterministic offline sample data with zero backend dependencies for product evaluation.'}
                </p>
              </div>

              <div>
                <strong>Backend Service Status:</strong>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={backendStatus === 'online' ? 'success' : 'critical'}>
                    {backendStatus === 'online' ? 'BACKEND ONLINE (127.0.0.1:8000)' : 'BACKEND OFFLINE'}
                  </Badge>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Direct REST communication via centralized API client with timeout and error interceptors.
                </p>
              </div>

              <div>
                <strong>AI Remediation Engine:</strong>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant="info">
                    <Sparkles size={11} />
                    <span>GOOGLE GEMINI 2.5 / FLASH</span>
                  </Badge>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Server-side Gemini explanation layer providing plain-language explanations, architectural trade-offs, and refactoring diffs.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
