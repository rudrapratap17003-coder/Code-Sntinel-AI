import React from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import {
  Button,
  Badge,
  Table,
  EmptyState,
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
  const {
    currentAnalysis,
    isDemoMode,
    activeFinding,
    selectFinding,
    clearActiveFinding,
    loadDemoAnalysis,
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
        {/* SECTION A: Page Header */}
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
    repository,
    summary,
    indicators = [],
    priorityFindings = [],
    findings = [],
    hotspots = [],
  } = currentAnalysis;

  const criticalCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'critical').length;
  const highCount = findings.filter((f) => (f.severity || '').toLowerCase() === 'high').length;
  const hotspotsCount = hotspots.length;

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
      {/* SECTION A: Page Header                                               */}
      {/* -------------------------------------------------------------------- */}
      <header className="command-center-header">
        <div>
          <h1 className="command-center-title">
            <Shield size={22} style={{ color: 'var(--accent-primary)' }} />
            Command Center
          </h1>
          <p className="command-center-subtitle">
            Understand code health, investigate technical debt, and prioritize engineering improvements.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {/* Target Repository Branch context */}
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

          {/* Environment / dataset badge */}
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
      {/* SECTION B: Repository Summary (4 Compact Cards)                      */}
      {/* -------------------------------------------------------------------- */}
      <section aria-label="Repository Summary Metrics">
        <div className="summary-cards-grid">
          {/* 1. Files Examined */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Files Examined</span>
              <FileCode size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value">
              {typeof repository.filesExamined === 'number'
                ? `${repository.filesExamined.toLocaleString()} files`
                : 'Not available'}
            </div>
            <div className="summary-stat-supporting">
              {isDemoMode ? 'Demo files examined (sample)' : 'Source files analyzed'}
            </div>
          </div>

          {/* 2. Total Findings & Severity Breakdown */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Total Findings</span>
              <ShieldAlert size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value">
              {typeof repository.findingsCount === 'number'
                ? `${repository.findingsCount.toLocaleString()} issues`
                : `${findings.length} issues`}
            </div>
            <div className="summary-stat-supporting" style={{ flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ color: criticalCount > 0 ? 'var(--color-severity-critical)' : 'var(--color-accent-primary)', fontWeight: 'bold' }}>
                {criticalCount} Critical
              </span>
              <span>•</span>
              <span style={{ color: highCount > 0 ? 'var(--color-severity-medium)' : 'var(--text-secondary)' }}>
                {highCount} High
              </span>
              {hotspotsCount > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--color-accent-primary)' }}>
                    {hotspotsCount} Hotspots
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 3. Estimated Remediation Effort */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Estimated Effort</span>
              <Clock size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value">
              {summary.remediationEstimateHours
                ? `${summary.remediationEstimateHours} hrs`
                : 'Not available'}
            </div>
            <div className="summary-stat-supporting">
              {isDemoMode ? 'Illustrative remediation estimate' : 'Projected remediation time'}
            </div>
          </div>

          {/* 4. Last Analysis */}
          <div className="summary-stat-card">
            <div className="summary-stat-header">
              <span className="summary-stat-label">Last Analysis</span>
              <Calendar size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="summary-stat-value" style={{ fontSize: '1.05rem', paddingTop: '4px' }}>
              {repository.displayTimestamp || 'Not available'}
            </div>
            <div className="summary-stat-supporting">
              {isDemoMode ? 'Demo dataset timestamp (no scan run)' : 'Static analysis timestamp'}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION C: CMDI Score (Code Maintainability Debt Index)              */}
      {/* -------------------------------------------------------------------- */}
      <section aria-labelledby="cmdi-section-heading">
        <div
          className="cmdi-card"
          style={{ borderLeftColor: cmdiBorderColor }}
        >
          {/* Header Row: Standardized Title, Badges, and Action Button */}
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

          {/* Main Row: Prominent Score + Illustrative Explanation */}
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

          {/* Accessible Horizontal Meter */}
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
      {/* SECTION D: Core Code-Health Indicators (4 Cards)                     */}
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
      {/* SECTION E: Priority Findings                                         */}
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
      {/* SECTION F: Recommended Next Action                                   */}
      {/* -------------------------------------------------------------------- */}
      <section aria-labelledby="next-action-heading">
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
              id="next-action-heading"
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
              Recommended Next Action
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
              {isDemoMode
                ? 'When using demonstration data, an actual repository analysis is required before the displayed metrics and priorities can be trusted. Submit a public GitHub repository to calculate genuine McCabe cyclomatic scores, token duplication, and import cycles.'
                : 'Run an incremental static analysis pass on your repository branch to refresh metrics, verify remediations, and track maintainability score velocity.'}
            </p>
          </div>

          <Button
            to={ROUTES.REPOSITORY}
            variant="primary"
            icon={<Play size={14} />}
          >
            Analyze Repository
          </Button>
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
