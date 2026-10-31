import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  GitBranch,
  FileCode,
  ShieldAlert,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  Play,
  Flame,
  Network,
  Copy,
  AlertTriangle,
  HelpCircle,
  FolderPlus,
  Activity,
  Layers,
  GitCompare,
  TrendingUp,
  RotateCcw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  Button,
  Badge,
  Table,
  EmptyState,
  Card,
  CardHeader,
  CardBody,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ROUTES } from '../../utils/constants';
import { FindingDetailModal } from '../../components/findings/FindingDetailModal';

/**
 * Sentinel Command Center — Overview Page.
 *
 * Provides a high-density, production-grade intelligence dashboard
 * answering: Where are the maintainability problems? Why do they matter?
 * What should be fixed first?
 */
export function OverviewPage() {
  useDocumentTitle('Command Center — CodeSentinel AI');
  const navigate = useNavigate();
  const {
    currentAnalysis,
    isDemoMode,
    activeFinding,
    selectFinding,
    clearActiveFinding,
    loadDemoAnalysis,
    historyRecords = [],
    restoreAnalysis,
  } = useAnalysis();

  // Standard indicator descriptions mandated by Part 5 Section D
  const INDICATOR_DESCRIPTIONS = {
    complexity:
      'Measures the complexity of analyzed functions, including cyclomatic complexity when supported by the analysis engine.',
    duplication:
      'Identifies repeated code blocks when supported by the duplication detector.',
    coupling:
      'Examines dependencies between modules and identifies circular dependencies when detected.',
    error_handling:
      'Examines exception-handling patterns, swallowed exceptions, and inconsistent error propagation when supported by the analysis engine.',
  };

  // --------------------------------------------------------------------------
  // EMPTY STATE: If no analysis is loaded
  // --------------------------------------------------------------------------
  if (!currentAnalysis) {
    return (
      <div className="command-center-container">
        {/* Header */}
        <header className="command-center-header">
          <div>
            <h1 className="command-center-title">
              <Shield size={24} style={{ color: 'var(--accent-primary)' }} />
              Command Center
            </h1>
            <p className="command-center-subtitle">
              Understand code health, investigate technical debt, and prioritize engineering improvements.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Badge variant="demo">
              <Sparkles size={11} />
              <span>DEMO READY</span>
            </Badge>
          </div>
        </header>

        {/* Empty State Banner */}
        <div style={{ maxWidth: '680px', margin: 'var(--space-2xl) auto', width: '100%' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--accent-primary)" />}
            title="No Repository Analysis Selected"
            description="No codebase analysis results are currently loaded. You can submit a GitHub repository URL for real static analysis or load the deterministic demonstration dataset to evaluate the platform."
            action={
              <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  variant="primary"
                  icon={<Sparkles size={16} />}
                  onClick={loadDemoAnalysis}
                >
                  Load Demonstration Analysis
                </Button>
                <Button
                  to={ROUTES.REPOSITORY}
                  variant="secondary"
                  icon={<Play size={16} />}
                >
                  Analyze Repository
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const {
    repository = {},
    summary = {},
    indicators = [],
    priorityFindings = [],
    findings = [],
    hotspots = [],
  } = currentAnalysis;

  const criticalCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'critical').length;
  const highCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'high').length;
  const mediumCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'medium').length;
  const lowCount = findings.filter((f) => {
    const s = (f.severity || '').toLowerCase();
    return s === 'low' || s === 'info';
  }).length;
  const totalFindings = findings.length || repository?.findingsCount || 0;

  // CMDI score clamp & tier mapping
  const isScoreAvailable =
    summary.scoreAvailable !== false &&
    summary.score_available !== false &&
    summary.cmdi !== null &&
    summary.riskCategory !== 'Not Available' &&
    summary.risk_category !== 'Not Available';
  const cmdiValue = isScoreAvailable && typeof summary.cmdi === 'number' ? summary.cmdi : 0;
  const clampedCmdi = Math.max(0, Math.min(100, cmdiValue));

  let cmdiBorderColor = isScoreAvailable ? 'var(--accent-primary)' : 'var(--color-border)';
  let cmdiRiskTier = isScoreAvailable ? 'Low Risk' : 'Not Available';
  if (isScoreAvailable) {
    if (clampedCmdi > 75) {
      cmdiBorderColor = 'var(--severity-critical)';
      cmdiRiskTier = 'Critical Risk';
    } else if (clampedCmdi > 50) {
      cmdiBorderColor = 'var(--severity-warning)';
      cmdiRiskTier = 'High Risk';
    } else if (clampedCmdi > 25) {
      cmdiBorderColor = 'var(--severity-info)';
      cmdiRiskTier = 'Moderate Risk';
    }
  }

  // Map 4 core indicators safely
  const findIndicator = (key) => indicators.find((ind) => ind.id === key);
  const complexityInd = findIndicator('complexity');
  const duplicationInd = findIndicator('duplication');
  const couplingInd = findIndicator('coupling');
  const errorHandlingInd = findIndicator('error_handling');

  // Priority findings table column definitions
  const findingsColumns = [
    {
      key: 'severity',
      label: 'Severity',
      width: '110px',
      render: (val) => {
        const severityStr = (val || 'info').toLowerCase();
        let badgeVariant = 'info';
        if (severityStr === 'critical') badgeVariant = 'critical';
        else if (severityStr === 'high' || severityStr === 'medium') badgeVariant = 'medium';
        return (
          <Badge variant={badgeVariant}>
            {severityStr.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'title',
      label: 'Finding & Rule',
      render: (title, row) => (
        <div>
          <div style={{ fontWeight: 'var(--font-medium)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
            {title}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {row.ruleId || row.rule_id || 'static/rule'}
          </div>
        </div>
      ),
    },
    {
      key: 'file',
      label: 'Location',
      render: (file, row) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--text-primary)' }}>{file}</span>
          <div style={{ color: 'var(--text-secondary)', marginTop: '1px' }}>
            {row.lineRange || row.line_range || 'file-level'}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: '140px',
      render: (cat) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {cat || 'Maintainability'}
        </span>
      ),
    },
    {
      key: 'recommendedRemediation',
      label: 'Recommended Next Step',
      render: (action, row) => (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', maxWidth: '320px', lineHeight: '1.4' }}>
          {action || row.recommended_remediation || row.recommendedAction || 'Inspect finding details.'}
        </div>
      ),
    },
  ];

  return (
    <div className="command-center-container">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION A: Welcome Header                                            */}
      {/* -------------------------------------------------------------------- */}
      <header className="command-center-header">
        <div>
          <h1 className="command-center-title">
            <Shield size={22} style={{ color: 'var(--accent-primary)' }} />
            Command Center
          </h1>
          <p className="command-center-subtitle">
            Target repository: <strong>{repository.name || 'Codebase'}</strong> • Understand code health, investigate technical debt, and prioritize engineering improvements.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {repository?.branch && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
              }}
              title={`Target Repository: ${repository.name || 'Sample repository'}`}
            >
              <GitBranch size={13} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Branch:</span>
              <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                {repository.branch}
              </span>
              {repository.commitHash && (
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  • {repository.commitHash.slice(0, 7)}
                </span>
              )}
            </div>
          )}

          {isDemoMode ? (
            <Badge variant="demo" title="Displayed metrics are demonstration heuristics and simulated analysis values.">
              <Sparkles size={11} />
              <span>DEMO DATA</span>
            </Badge>
          ) : (
            <Badge variant="success" title="Metrics computed from real Python static AST and Radon analysis.">
              <Sparkles size={11} />
              <span>REAL ANALYSIS</span>
            </Badge>
          )}
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION B: Key Metric Cards (5 Cards)                                */}
      {/* -------------------------------------------------------------------- */}
      <section aria-label="Key Metric Cards">
        <div className="summary-cards-grid">
          {/* 1. CMDI Score */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">CMDI Score</span>
              <Activity size={15} style={{ color: isScoreAvailable ? 'var(--color-accent-primary)' : 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value" style={{ color: isScoreAvailable ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {isScoreAvailable ? clampedCmdi.toFixed(1) : 'Not Available'}
            </div>
            <div className="summary-stat-supporting">
              <Badge variant={summary.riskSeverity || (isScoreAvailable ? 'medium' : 'default')} style={{ fontSize: '10px' }}>
                {summary.riskCategory || cmdiRiskTier}
              </Badge>
            </div>
          </div>

          {/* 2. Total Findings */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Total Findings</span>
              <ShieldAlert size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value">
              {totalFindings.toLocaleString()}
            </div>
            <div className="summary-stat-supporting">
              <span>AST violations detected</span>
            </div>
          </div>

          {/* 3. Critical Findings */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Critical Findings</span>
              <AlertCircle size={15} style={{ color: criticalCount > 0 ? 'var(--color-severity-critical)' : 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value" style={{ color: criticalCount > 0 ? 'var(--color-severity-critical)' : 'var(--color-accent-primary)' }}>
              {criticalCount}
            </div>
            <div className="summary-stat-supporting">
              <span>{criticalCount > 0 ? 'Immediate action required' : 'No critical issues'}</span>
            </div>
          </div>

          {/* 4. High-Priority Findings */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">High Priority</span>
              <Flame size={15} style={{ color: highCount > 0 ? 'var(--color-severity-medium)' : 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value" style={{ color: highCount > 0 ? 'var(--color-severity-medium)' : 'var(--text-primary)' }}>
              {highCount}
            </div>
            <div className="summary-stat-supporting">
              <span>High-blast-radius debt</span>
            </div>
          </div>

          {/* 5. Analyzed Files */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Analyzed Files</span>
              <FileCode size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value">
              {typeof repository.filesExamined === 'number'
                ? repository.filesExamined.toLocaleString()
                : 'Not available'}
            </div>
            <div className="summary-stat-supporting">
              <span>Python source modules</span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION C: CMDI Score Visualization                                  */}
      {/* -------------------------------------------------------------------- */}
      <section aria-labelledby="cmdi-section-heading">
        <div
          className="cmdi-card"
          style={{ borderLeftColor: cmdiBorderColor }}
        >
          {/* Header Row */}
          <div className="cmdi-header-row">
            <div className="cmdi-title-group">
              <h2
                id="cmdi-section-heading"
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                Code Maintainability Debt Index (CMDI)
              </h2>
              <Badge variant={summary.riskSeverity || (isScoreAvailable ? 'medium' : 'default')}>
                {summary.riskCategory || cmdiRiskTier}
              </Badge>
              {isDemoMode && (
                <Badge variant="demo" style={{ fontSize: '10px' }}>
                  DEMO CMDI METRIC
                </Badge>
              )}
            </div>

            <Button
              to={ROUTES.TECHNICAL_DEBT}
              variant="secondary"
              iconEnd={<ArrowRight size={14} />}
              style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}
            >
              Explore Debt Breakdown
            </Button>
          </div>

          {/* Main Row */}
          <div className="cmdi-main-row">
            <div className="cmdi-score-block">
              <span className="cmdi-score-number">
                {isScoreAvailable ? clampedCmdi.toFixed(1) : 'Not Available'}
              </span>
              {isScoreAvailable && (
                <span className="cmdi-score-scale">
                  / 100
                </span>
              )}
              <span className="cmdi-score-badge-text">
                ({summary.riskCategory || cmdiRiskTier}{isDemoMode ? ' • Illustrative' : ''})
              </span>
            </div>

            <div className="cmdi-explanation-container">
              <p className="cmdi-explanation-text">
                {isScoreAvailable ? (
                  summary.interpretation || 'Maintainability assessment computed from structural indicators.'
                ) : (
                  summary.interpretation || 'No valid AST indicators were measurable for this repository to compute CMDI.'
                )}
              </p>
            </div>
          </div>

          {/* Meter Bar */}
          <div
            className="cmdi-meter-track"
            role="meter"
            aria-valuenow={isScoreAvailable ? clampedCmdi : 0}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Code Maintainability Debt Index score meter"
          >
            <div
              className="cmdi-meter-gradient"
              style={{ width: isScoreAvailable ? `${clampedCmdi}%` : '0%' }}
            />
            {isScoreAvailable && (
              <div
                className="cmdi-meter-pin"
                style={{ left: `${clampedCmdi}%` }}
                title={`Score: ${clampedCmdi.toFixed(1)}`}
              />
            )}
          </div>

          <div className="cmdi-meter-tiers" aria-hidden="true">
            <span style={{ color: '#00F5A0' }}>0 Low Risk (0–25)</span>
            <span style={{ color: '#55C7E8' }}>Moderate (26–50)</span>
            <span style={{ color: '#F5B942' }}>High (51–75)</span>
            <span style={{ color: '#FF5D68' }}>Critical (76–100) 100</span>
          </div>

          <p className="cmdi-disclaimer">
            <HelpCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            The Code Maintainability Debt Index (CMDI) is a project-defined heuristic score (0–100) calculated from static AST indicators. It is not an established universal standard.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION D: Technical Debt Overview & Severity Distribution           */}
      {/* -------------------------------------------------------------------- */}
      <section aria-labelledby="debt-overview-heading">
        <Card>
          <CardHeader
            title="Technical Debt Overview"
            subtitle={`Severity breakdown of ${totalFindings} detected maintainability findings across source modules.`}
            action={
              <Button
                to={ROUTES.FINDINGS}
                variant="ghost"
                size="sm"
                iconEnd={<ArrowRight size={13} />}
              >
                Inspect Ledger
              </Button>
            }
          />
          <CardBody>
            {/* Visual stacked distribution bar */}
            <div className="severity-bar-track" title={`Critical: ${criticalCount}, High: ${highCount}, Medium: ${mediumCount}, Low: ${lowCount}`}>
              {criticalCount > 0 && (
                <div
                  className="severity-bar-segment"
                  style={{
                    width: `${(criticalCount / (totalFindings || 1)) * 100}%`,
                    backgroundColor: 'var(--color-severity-critical)',
                  }}
                />
              )}
              {highCount > 0 && (
                <div
                  className="severity-bar-segment"
                  style={{
                    width: `${(highCount / (totalFindings || 1)) * 100}%`,
                    backgroundColor: 'var(--color-severity-medium)',
                  }}
                />
              )}
              {mediumCount > 0 && (
                <div
                  className="severity-bar-segment"
                  style={{
                    width: `${(mediumCount / (totalFindings || 1)) * 100}%`,
                    backgroundColor: '#F5B942',
                  }}
                />
              )}
              {lowCount > 0 && (
                <div
                  className="severity-bar-segment"
                  style={{
                    width: `${(lowCount / (totalFindings || 1)) * 100}%`,
                    backgroundColor: 'var(--color-severity-info)',
                  }}
                />
              )}
              {totalFindings === 0 && (
                <div
                  className="severity-bar-segment"
                  style={{ width: '100%', backgroundColor: 'var(--color-border)' }}
                />
              )}
            </div>

            {/* Severity Legend */}
            <div className="severity-legend">
              <div className="severity-legend-item">
                <span className="severity-dot" style={{ backgroundColor: 'var(--color-severity-critical)' }} />
                <span>Critical: <strong>{criticalCount}</strong></span>
              </div>
              <div className="severity-legend-item">
                <span className="severity-dot" style={{ backgroundColor: 'var(--color-severity-medium)' }} />
                <span>High: <strong>{highCount}</strong></span>
              </div>
              <div className="severity-legend-item">
                <span className="severity-dot" style={{ backgroundColor: '#F5B942' }} />
                <span>Medium: <strong>{mediumCount}</strong></span>
              </div>
              <div className="severity-legend-item">
                <span className="severity-dot" style={{ backgroundColor: 'var(--color-severity-info)' }} />
                <span>Low / Info: <strong>{lowCount}</strong></span>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION E: Core Code-Health Indicators (4 Cards)                     */}
      {/* -------------------------------------------------------------------- */}
      <section aria-labelledby="indicators-section-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
          <h2
            id="indicators-section-heading"
            style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}
          >
            Core Code-Health Indicators
          </h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            4 Dimensions of Technical Debt
          </span>
        </div>

        <div className="indicators-grid">
          {/* 1. Complexity */}
          <div className="indicator-card">
            <div className="indicator-top">
              <div className="indicator-header">
                <span className="indicator-name">Complexity</span>
                {complexityInd && complexityInd.normalizedRisk !== null ? (
                  <Badge variant={complexityInd.severity === 'critical' ? 'critical' : 'medium'}>
                    {(complexityInd.severity || 'high').toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="default">NOT MEASURED</Badge>
                )}
              </div>
              <div className="indicator-value">
                {complexityInd && complexityInd.rawMetric ? complexityInd.rawMetric : 'Not measured'}
              </div>
              <p className="indicator-description">
                {INDICATOR_DESCRIPTIONS.complexity}
              </p>
            </div>
            <div className="indicator-footer">
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {isDemoMode ? 'DEMO VALUE' : 'STATIC AST'}
              </span>
              <Link
                to={ROUTES.TECHNICAL_DEBT}
                style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                <span>Inspect</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* 2. Code Duplication */}
          <div className="indicator-card">
            <div className="indicator-top">
              <div className="indicator-header">
                <span className="indicator-name">Code Duplication</span>
                {duplicationInd && duplicationInd.normalizedRisk !== null ? (
                  <Badge variant="medium">
                    {(duplicationInd.severity || 'medium').toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="default">NOT MEASURED</Badge>
                )}
              </div>
              <div className="indicator-value">
                {duplicationInd && duplicationInd.rawMetric ? duplicationInd.rawMetric : 'Not measured'}
              </div>
              <p className="indicator-description">
                {INDICATOR_DESCRIPTIONS.duplication}
              </p>
            </div>
            <div className="indicator-footer">
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {isDemoMode ? 'DEMO VALUE' : 'TOKEN CLONES'}
              </span>
              <Link
                to={ROUTES.FINDINGS}
                style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                <span>Inspect</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* 3. Architectural Coupling */}
          <div className="indicator-card">
            <div className="indicator-top">
              <div className="indicator-header">
                <span className="indicator-name">Architectural Coupling</span>
                {couplingInd && couplingInd.normalizedRisk !== null ? (
                  <Badge variant={couplingInd.severity === 'critical' ? 'critical' : 'medium'}>
                    {(couplingInd.severity || 'critical').toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="default">NOT MEASURED</Badge>
                )}
              </div>
              <div className="indicator-value">
                {couplingInd && couplingInd.rawMetric ? couplingInd.rawMetric : 'Not measured'}
              </div>
              <p className="indicator-description">
                {INDICATOR_DESCRIPTIONS.coupling}
              </p>
            </div>
            <div className="indicator-footer">
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {isDemoMode ? 'DEMO VALUE' : 'IMPORT GRAPH'}
              </span>
              <Link
                to={ROUTES.ARCHITECTURE}
                style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                <span>Inspect</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* 4. Error-Handling Consistency */}
          <div className="indicator-card">
            <div className="indicator-top">
              <div className="indicator-header">
                <span className="indicator-name">Error-Handling</span>
                {errorHandlingInd && errorHandlingInd.normalizedRisk !== null ? (
                  <Badge variant="medium">
                    {(errorHandlingInd.severity || 'medium').toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="default">NOT MEASURED</Badge>
                )}
              </div>
              <div className="indicator-value">
                {errorHandlingInd && errorHandlingInd.rawMetric ? errorHandlingInd.rawMetric : 'Not measured'}
              </div>
              <p className="indicator-description">
                {INDICATOR_DESCRIPTIONS.error_handling}
              </p>
            </div>
            <div className="indicator-footer">
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {isDemoMode ? 'DEMO VALUE' : 'AST HEURISTIC'}
              </span>
              <Link
                to={ROUTES.FINDINGS}
                style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                <span>Inspect</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION F: Top Hotspots Preview                                      */}
      {/* -------------------------------------------------------------------- */}
      {hotspots && hotspots.length > 0 && (
        <section aria-labelledby="top-hotspots-heading">
          <Card>
            <CardHeader
              title="Top Module Hotspots"
              subtitle="Modules where cyclomatic complexity, incoming fan-in, and error risks intersect."
              action={
                <Button
                  to={ROUTES.INSIGHTS}
                  variant="ghost"
                  size="sm"
                  iconEnd={<ArrowRight size={13} />}
                >
                  View All Hotspots
                </Button>
              }
            />
            <CardBody style={{ padding: 0 }}>
              <div className="findings-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module Path</th>
                      <th>Risk Classification</th>
                      <th>Complexity</th>
                      <th>Afferent Coupling</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotspots.slice(0, 4).map((h, idx) => (
                      <tr key={h.module || h.module_name || idx}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                          {h.module || h.module_name || 'module'}
                        </td>
                        <td>
                          <Badge variant={h.risk === 'critical' || h.classification?.includes('Critical') ? 'critical' : 'medium'}>
                            {h.classification || h.risk || 'Hotspot'}
                          </Badge>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                          v(G) = {h.complexity ?? h.highest_cyclomatic_complexity ?? 'N/A'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                          {h.coupling ?? h.afferent_coupling ?? 0} callers
                        </td>
                        <td>
                          <Link
                            to={ROUTES.INSIGHTS}
                            style={{ color: 'var(--color-accent-primary)', fontSize: 'var(--text-xs)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>Inspect</span>
                            <ArrowRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </section>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SECTION G: Recent Analysis History                                   */}
      {/* -------------------------------------------------------------------- */}
      {historyRecords && historyRecords.length > 0 && (
        <section aria-labelledby="recent-history-heading">
          <Card>
            <CardHeader
              title="Recent Analysis History"
              subtitle="Saved snapshots available for immediate inspection and comparison."
              action={
                <Button
                  to={ROUTES.HISTORY}
                  variant="ghost"
                  size="sm"
                  iconEnd={<ArrowRight size={13} />}
                >
                  Full History ({historyRecords.length})
                </Button>
              }
            />
            <CardBody style={{ padding: 0 }}>
              <div className="findings-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Repository</th>
                      <th>Analyzed At</th>
                      <th>CMDI Score</th>
                      <th>Risk Tier</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.slice(0, 4).map((record) => (
                      <tr key={record.id}>
                        <td>
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                            {record.repository?.name || 'Repository'}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {record.displayTimestamp || record.timestamp || 'Snapshot'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: '600' }}>
                          {typeof record.summary?.cmdi === 'number' ? record.summary.cmdi.toFixed(1) : 'N/A'}
                        </td>
                        <td>
                          <Badge variant={record.summary?.riskSeverity || 'default'}>
                            {record.summary?.riskCategory || 'Unknown'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => restoreAnalysis(record)}
                            icon={<RotateCcw size={12} />}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </section>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SECTION H: Priority Findings                                         */}
      {/* -------------------------------------------------------------------- */}
      <section aria-labelledby="priority-findings-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <h2
                id="priority-findings-heading"
                style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}
              >
                Priority Findings
              </h2>
              {isDemoMode && (
                <Badge variant="demo" style={{ fontSize: '10px' }}>
                  DEMO FINDINGS
                </Badge>
              )}
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {isDemoMode
                ? 'Illustrative finding samples representing high-impact maintainability patterns. (Demonstration dataset — no live repository scan was executed).'
                : 'Investigate high-impact maintainability issues requiring immediate engineering attention.'}
            </p>
          </div>

          <Button
            to={ROUTES.FINDINGS}
            variant="secondary"
            iconEnd={<ArrowRight size={14} />}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            View All Findings
          </Button>
        </div>

        <div className="summary-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="findings-table-scroll">
            <Table
              columns={findingsColumns}
              data={priorityFindings.length > 0 ? priorityFindings : []}
              onRowClick={(row) => selectFinding(row)}
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION I: Quick Actions                                             */}
      {/* -------------------------------------------------------------------- */}
      <section aria-labelledby="quick-actions-heading">
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg) var(--space-xl)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-lg)',
          }}
        >
          <div style={{ maxWidth: '640px' }}>
            <h2
              id="quick-actions-heading"
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--text-primary)',
                margin: '0 0 4px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
              }}
            >
              <Play size={16} style={{ color: 'var(--accent-primary)' }} />
              Quick Actions
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
              Quickly navigate between repository analysis, snapshot comparisons, and historical trends.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <Button
              to={ROUTES.REPOSITORY}
              variant="primary"
              icon={<Play size={14} />}
            >
              Analyze Another Repo
            </Button>
            <Button
              to={ROUTES.COMPARE}
              variant="secondary"
              icon={<GitCompare size={14} />}
            >
              Compare Snapshots
            </Button>
            <Button
              to={ROUTES.TRENDS}
              variant="secondary"
              icon={<TrendingUp size={14} />}
            >
              Historical Trends
            </Button>
          </div>
        </div>
      </section>

      {/* Finding Detail Inspection Modal (Preserved for deep inspection) */}
      <FindingDetailModal
        finding={activeFinding}
        onClose={clearActiveFinding}
      />
    </div>
  );
}

export default OverviewPage;
