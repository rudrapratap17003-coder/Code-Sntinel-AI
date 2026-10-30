import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitPullRequest,
  Github,
  Play,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Network,
  Compass,
  Sparkles,
  Info,
  Server,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Input,
  Button,
  Badge,
  ErrorMessage,
  MetricCard,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { validateGitHubUrl } from '../../utils/urlValidator';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ROUTES } from '../../utils/constants';

export function RepositoryPage() {
  useDocumentTitle('Repository Analysis');
  const navigate = useNavigate();

  const {
    currentAnalysis,
    submittedRepoUrl,
    setSubmittedRepoUrl,
    isAnalyzing,
    analysisStage,
    analysisError,
    clearAnalysisError,
    analysisMode,
    setAnalysisMode,
    backendStatus,
    backendMeta,
    checkBackendStatus,
    runLiveAnalysis,
    runDemoAnalysis,
  } = useAnalysis();

  const [inputUrl, setInputUrl] = useState(submittedRepoUrl || '');
  const [validationError, setValidationError] = useState('');
  const [justAnalyzed, setJustAnalyzed] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    clearAnalysisError();
    setJustAnalyzed(false);

    const validation = validateGitHubUrl(inputUrl);

    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    // Keep URL in sync in context
    setSubmittedRepoUrl(validation.normalizedUrl);

    if (analysisMode === 'live') {
      try {
        await runLiveAnalysis(validation, {
          onSuccess: () => {
            setJustAnalyzed(true);
          },
          onError: () => {
            setJustAnalyzed(false);
          },
        });
      } catch {
        // Error state handled through analysisError in context
      }
    } else {
      runDemoAnalysis(validation, () => {
        setJustAnalyzed(true);
      });
    }
  };

  const handleReset = () => {
    setInputUrl('');
    setValidationError('');
    clearAnalysisError();
    setJustAnalyzed(false);
  };

  const handleQuickSample = (sampleUrl) => {
    setInputUrl(sampleUrl);
    setValidationError('');
    clearAnalysisError();
  };

  const handleRetry = () => {
    clearAnalysisError();
    const fakeEvent = { preventDefault: () => {} };
    handleSubmit(fakeEvent);
  };

  return (
    <div>
      {/* 1. Page Header */}
      <PageHeader
        title="Repository Analysis"
        icon={<GitPullRequest size={24} />}
        description="Inspect a Python codebase to understand its complexity, duplication, structural dependencies, and maintainability risks."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Badge variant={analysisMode === 'live' ? 'success' : 'demo'}>
              {analysisMode === 'live' ? (
                <>
                  <Cpu size={12} />
                  <span>REAL ENGINE MODE</span>
                </>
              ) : (
                <>
                  <Sparkles size={11} />
                  <span>DEMO PIPELINE</span>
                </>
              )}
            </Badge>

            <button
              type="button"
              onClick={() => checkBackendStatus()}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
              }}
              title="Click to re-check backend engine status"
            >
              {backendStatus === 'online' && (
                <Badge variant="success">
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#00F5A0', marginRight: '4px' }} />
                  <span>Backend Online</span>
                </Badge>
              )}
              {backendStatus === 'checking' && (
                <Badge variant="default">
                  <RefreshCw size={10} className="spinning-icon" />
                  <span>Checking Engine...</span>
                </Badge>
              )}
              {backendStatus === 'offline' && (
                <Badge variant="critical">
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#FF5D68', marginRight: '4px' }} />
                  <span>Backend Offline</span>
                </Badge>
              )}
            </button>
          </div>
        }
      />

      {/* 2. Mode Selector & Backend Awareness Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-sm) var(--space-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>
            Analysis Engine:
          </span>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface-elevated)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
            <button
              type="button"
              onClick={() => {
                setAnalysisMode('live');
                clearAnalysisError();
              }}
              style={{
                border: 'none',
                background: analysisMode === 'live' ? 'var(--color-accent-primary)' : 'transparent',
                color: analysisMode === 'live' ? '#080B0A' : 'var(--color-text-muted)',
                fontWeight: analysisMode === 'live' ? 'var(--font-semibold)' : 'var(--font-regular)',
                fontSize: 'var(--text-xs)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Cpu size={12} />
              <span>Real Python Static Engine</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalysisMode('demo');
                clearAnalysisError();
              }}
              style={{
                border: 'none',
                background: analysisMode === 'demo' ? 'var(--color-accent-primary)' : 'transparent',
                color: analysisMode === 'demo' ? '#080B0A' : 'var(--color-text-muted)',
                fontWeight: analysisMode === 'demo' ? 'var(--font-semibold)' : 'var(--font-regular)',
                fontSize: 'var(--text-xs)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Sparkles size={12} />
              <span>Demo Mode (Offline)</span>
            </button>
          </div>
        </div>

        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {analysisMode === 'live' ? (
            <span>
              Real Ingestion: Clones repository tarball securely into sandboxed memory, parses AST, runs McCabe complexity &amp; Tarjan SCC cycles.
            </span>
          ) : (
            <span>
              Offline Evaluation: Analyzes against deterministic local demonstration models without remote calls.
            </span>
          )}
        </div>
      </div>

      {/* 3. High-Visibility Error Banner (Never silently falls back to demo data) */}
      {analysisError && (
        <div
          style={{
            backgroundColor: 'rgba(255, 93, 104, 0.1)',
            border: '1px solid var(--color-severity-critical)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-lg)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
            <AlertCircle size={20} color="var(--color-severity-critical)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ color: 'var(--color-severity-critical)', fontSize: 'var(--text-sm)', display: 'block', marginBottom: '4px' }}>
                Analysis Failed: {analysisError.code || 'ENGINE_ERROR'}
              </strong>
              <p style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-xs)', lineHeight: '1.5', margin: 0 }}>
                {analysisError.message}
              </p>
              {analysisError.detail && typeof analysisError.detail === 'string' && analysisError.detail !== analysisError.message && (
                <pre
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-xs)',
                    marginTop: '8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {analysisError.detail}
                </pre>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRetry}
                  disabled={isAnalyzing}
                  icon={<RotateCcw size={14} />}
                  style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
                >
                  Retry Analysis
                </Button>
                {backendStatus === 'offline' && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setAnalysisMode('demo');
                      clearAnalysisError();
                    }}
                    icon={<Sparkles size={14} />}
                    style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
                  >
                    Switch to Demo Mode
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAnalysisError}
                  style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Input Card & Ingestion Workflow */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
        <Card>
          <CardHeader
            title="Target GitHub Repository"
            subtitle={
              analysisMode === 'live'
                ? 'Enter any public Python GitHub repository to run live AST static analysis'
                : 'Enter any public repository to simulate maintainability intelligence'
            }
          />
          <CardBody>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <Input
                  label="GitHub Repository URL"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    if (validationError) setValidationError('');
                    if (analysisError) clearAnalysisError();
                  }}
                  placeholder="https://github.com/owner/repository"
                  icon={<Github size={16} />}
                  disabled={isAnalyzing}
                  hint="Example: https://github.com/pallets/flask or https://github.com/psf/requests"
                />

                {validationError && (
                  <div style={{ marginTop: 'var(--space-xs)' }}>
                    <ErrorMessage severity="critical" title="Validation Error">
                      {validationError}
                    </ErrorMessage>
                  </div>
                )}
              </div>

              {/* Quick Sample Suggestions */}
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>
                  Quick Try Python Repositories:
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleQuickSample('https://github.com/pallets/flask')}
                    style={{
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 8px',
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                    }}
                  >
                    pallets/flask
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSample('https://github.com/psf/requests')}
                    style={{
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 8px',
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                    }}
                  >
                    psf/requests
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSample('https://github.com/encode/starlette')}
                    style={{
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 8px',
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                    }}
                  >
                    encode/starlette
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSample('https://github.com/codesentinel/orchestrator-core')}
                    style={{
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 8px',
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                    }}
                  >
                    codesentinel/orchestrator-core
                  </button>
                </div>
              </div>

              {/* Progress Bar (Visible while analyzing) */}
              {isAnalyzing && analysisStage && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)',
                    marginTop: 'var(--space-xs)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--color-accent-primary)', fontWeight: 'var(--font-semibold)' }}>
                      Step {analysisStage.step} of 5: {analysisMode === 'live' ? 'Static Engine Analysis' : 'Demo Simulation'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {analysisStage.percent}%
                    </span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-fill" style={{ width: `${analysisStage.percent}%` }} />
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                    {analysisStage.label}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isAnalyzing}
                  icon={isAnalyzing ? undefined : <Play size={15} />}
                >
                  {isAnalyzing
                    ? (analysisMode === 'live' ? 'Analyzing Python AST...' : 'Running Demo Sequence...')
                    : (analysisMode === 'live' ? 'Analyze Repository (Live Engine)' : 'Run Demo Simulation')}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={isAnalyzing}
                  onClick={handleReset}
                  icon={<RotateCcw size={14} />}
                >
                  Reset Form
                </Button>
              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-sm)' }}>
                <span>• ZIP file uploads are disallowed. Repositories are streamed directly into sandbox memory without remote execution.</span>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Validation & Security Rules Card */}
        <Card elevated>
          <CardHeader
            title="Analysis Safeguards & Policy"
            subtitle="Security guarantees and architectural rules"
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                <CheckCircle2 size={16} color="var(--color-accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--color-text-primary)' }}>Encrypted HTTPS Protocol:</strong>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    All requests must use TLS-encrypted <code>https://</code>. Insecure <code>http://</code> endpoints are strictly rejected.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                <CheckCircle2 size={16} color="var(--color-accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--color-text-primary)' }}>Trusted Domain Authority:</strong>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Restricted strictly to <code>github.com</code>. Third-party or untrusted hosts are excluded.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                <CheckCircle2 size={16} color="var(--color-accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--color-text-primary)' }}>Zero Remote Execution:</strong>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    CodeSentinel never executes setup scripts, tests, or external packages. Analysis is purely AST-level.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                <CheckCircle2 size={16} color="var(--color-accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--color-text-primary)' }}>Resource Caps:</strong>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Max 50MB archive, max 500 files, and max 1MB per file to guarantee server stability.
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 5. RESULT SUMMARY (When an analysis is loaded in context) */}
      {currentAnalysis && (
        <Card style={{ borderColor: currentAnalysis.repository.isDemo ? 'rgba(85, 199, 232, 0.4)' : 'rgba(0, 245, 160, 0.4)' }}>
          <CardHeader
            title="Active Analysis Result"
            subtitle={`Target: ${currentAnalysis.repository.name}`}
            actions={
              <Badge variant={currentAnalysis.repository.isDemo ? 'demo' : 'success'}>
                {currentAnalysis.repository.isDemo ? (
                  <>
                    <Sparkles size={11} />
                    <span>DEMO ANALYSIS</span>
                  </>
                ) : (
                  <>
                    <Cpu size={11} />
                    <span>REAL PYTHON STATIC ANALYSIS</span>
                  </>
                )}
              </Badge>
            }
          />
          <CardBody>
            {/* Banner with strict disclosure */}
            {currentAnalysis.repository.isDemo ? (
              <div
                style={{
                  backgroundColor: 'rgba(85, 199, 232, 0.08)',
                  border: '1px solid rgba(85, 199, 232, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-lg)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                }}
              >
                <Info size={16} color="var(--color-severity-info)" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: 'var(--color-severity-info)' }}>
                    DEMONSTRATION ANALYSIS ACTIVE
                  </strong>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: '2px', margin: 0 }}>
                    This result is a deterministic reference model. To execute real static analysis, select <strong>Real Python Static Engine</strong> and submit a repository.
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'rgba(0, 245, 160, 0.08)',
                  border: '1px solid rgba(0, 245, 160, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-lg)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                }}
              >
                <CheckCircle2 size={16} color="var(--color-accent-primary)" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: 'var(--color-accent-primary)' }}>
                    REAL PYTHON STATIC ANALYSIS COMPLETED
                  </strong>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: '2px', margin: 0 }}>
                    Analysis computed via Python AST parser, Radon McCabe metrics, token duplicate detection, and static import graphs.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Metrics Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-md)',
                marginBottom: 'var(--space-xl)',
              }}
            >
              <MetricCard
                title="CMDI Score"
                value={`${currentAnalysis.summary.cmdi} / 100`}
                subtitle={currentAnalysis.summary.riskCategory}
                variant={currentAnalysis.summary.riskSeverity}
              />
              <MetricCard
                title="Files Examined"
                value={currentAnalysis.repository.filesExamined}
                subtitle={`${currentAnalysis.repository.linesOfCode?.toLocaleString?.() || currentAnalysis.repository.linesOfCode || 0} Lines of Code`}
              />
              <MetricCard
                title="Maintainability Findings"
                value={currentAnalysis.findings.length}
                subtitle={`${currentAnalysis.findings.filter((f) => f.severity === 'critical').length} Critical Severities`}
                variant={currentAnalysis.findings.filter((f) => f.severity === 'critical').length > 0 ? 'critical' : 'default'}
              />
              <MetricCard
                title="Remediation Estimate"
                value={`~${currentAnalysis.summary.remediationEstimateHours}h`}
                subtitle="Engineering hours to remediate"
              />
            </div>

            {/* Navigation Shortcuts to Deep Views */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <Button to={ROUTES.OVERVIEW} variant="primary" icon={<Compass size={14} />}>
                View Overview
              </Button>
              <Button to={ROUTES.TECHNICAL_DEBT} variant="secondary" icon={<Flame size={14} />}>
                Inspect Technical Debt (CMDI)
              </Button>
              <Button to={ROUTES.FINDINGS} variant="secondary" icon={<ShieldAlert size={14} />}>
                Explore Findings ({currentAnalysis.findings.length})
              </Button>
              <Button to={ROUTES.ARCHITECTURE} variant="secondary" icon={<Network size={14} />}>
                Architecture Graph
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default RepositoryPage;
