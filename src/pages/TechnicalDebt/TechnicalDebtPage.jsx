import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  Activity,
  Layers,
  Network,
  AlertTriangle,
  ArrowRight,
  FolderPlus,
  Play,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  EmptyState,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ROUTES } from '../../utils/constants';
import { getCmdiTier } from '../../utils/scoringEngine';
import { IndicatorDetailModal } from '../../components/technicalDebt/IndicatorDetailModal';

export function TechnicalDebtPage() {
  useDocumentTitle('Technical Debt Intelligence');

  const {
    currentAnalysis,
    loadDemoAnalysis,
  } = useAnalysis();

  const [selectedIndicator, setSelectedIndicator] = useState(null);

  // If no analysis is loaded, render empty state
  if (!currentAnalysis) {
    return (
      <div>
        <PageHeader
          title="Technical Debt Intelligence"
          icon={<Flame size={24} />}
          description="Quantify maintainability risk, evaluate indicator contributions, and prioritize actionable remediation."
        />

        <div style={{ maxWidth: '720px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
            title="No Codebase Analysis Selected"
            description="To explore the Composite Maintenance Debt Index (CMDI) and indicator breakdowns, submit a GitHub repository URL or initialize the demonstration dataset."
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
                  Analyze a Repository
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const { repository, summary, indicators, investigationQueue, hotspots } = currentAnalysis;
  const currentTier = getCmdiTier(summary.cmdi);

  const indicatorIcons = {
    complexity: <Activity size={18} color="var(--color-severity-critical)" />,
    duplication: <Layers size={18} color="var(--color-severity-medium)" />,
    coupling: <Network size={18} color="var(--color-severity-critical)" />,
    error_handling: <AlertTriangle size={18} color="var(--color-severity-medium)" />,
  };

  return (
    <div>
      {/* 1. Page Header */}
      <PageHeader
        title="Technical Debt Intelligence"
        icon={<Flame size={24} />}
        description="Quantify maintainability risk, evaluate indicator contributions, and prioritize actionable remediation."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Badge variant={repository.isDemo ? 'demo' : 'success'}>
              <Sparkles size={11} />
              <span>{repository.name} {repository.isDemo ? '(DEMO)' : '(REAL)'}</span>
            </Badge>
            <Button to={ROUTES.FINDINGS} variant="secondary" iconEnd={<ArrowRight size={14} />}>
              View All Findings
            </Button>
          </div>
        }
      />

      {/* 2. Composite Debt Score Visualization Card */}
      <Card
        style={{
          marginBottom: 'var(--space-xl)',
          background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%)',
          borderLeft: `4px solid ${currentTier.color}`,
        }}
      >
        <CardBody style={{ padding: 'var(--space-xl)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-xl)',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Composite Maintenance Debt Index (CMDI)
                </span>
                <Badge variant={currentTier.variant}>
                  {currentTier.label}
                </Badge>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '3.75rem',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {summary.cmdi}
                </span>
                <span style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  / 100
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-severity-critical)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    marginLeft: 'var(--space-sm)',
                  }}
                >
                  <TrendingUp size={13} />
                  <span>{summary.delta}</span>
                </span>
              </div>

              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-sm)' }}>
                {summary.interpretation}
              </p>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: '1.5', maxWidth: '640px' }}>
                {summary.scoringDisclaimer}
              </p>
            </div>

            {/* Quick Metrics & Effort Block */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Estimated Remediation Effort:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-primary)' }}>
                  {summary.remediationEstimateHours} engineering hours
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Analyzed Repository:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                  {repository.name}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Active Indicators:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-accent-primary)' }}>
                  4 of 4 Evaluated (100%)
                </span>
              </div>

              <Button
                to={ROUTES.FINDINGS}
                variant="primary"
                iconEnd={<ArrowRight size={15} />}
                style={{ width: '100%', marginTop: 'var(--space-xs)' }}
              >
                Inspect All Identified Issues
              </Button>
            </div>
          </div>

          {/* 3. Risk Tier Scale */}
          <div style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Risk Tier Scale
              </span>
              <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: currentTier.color }}>
                Current Score: {summary.cmdi} ({currentTier.label})
              </span>
            </div>

            {/* Horizontal Segmented Bar */}
            <div style={{ position: 'relative', height: '14px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-elevated)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ flex: '25', background: 'rgba(0, 245, 160, 0.35)', borderRight: '1px solid var(--color-bg)' }} title="0-25: Low Risk" />
              <div style={{ flex: '25', background: 'rgba(85, 199, 232, 0.35)', borderRight: '1px solid var(--color-bg)' }} title="26-50: Moderate Risk" />
              <div style={{ flex: '25', background: 'rgba(245, 185, 66, 0.45)', borderRight: '1px solid var(--color-bg)' }} title="51-75: High Risk" />
              <div style={{ flex: '25', background: 'rgba(255, 93, 104, 0.45)' }} title="76-100: Critical Risk" />
            </div>

            {/* Needle indicator */}
            <div style={{ position: 'relative', height: '18px', marginTop: '2px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: `${summary.cmdi}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `6px solid ${currentTier.color}` }} />
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: currentTier.color, fontWeight: 'bold' }}>
                  ▲ {summary.cmdi}
                </span>
              </div>
            </div>

            {/* Scale Legends */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)', textAlign: 'center', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ color: '#00F5A0' }}>0–25: Low</div>
              <div style={{ color: '#55C7E8' }}>26–50: Moderate</div>
              <div style={{ color: '#F5B942', fontWeight: 'bold' }}>51–75: High (Current)</div>
              <div style={{ color: '#FF5D68' }}>76–100: Critical</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 4. Four Core Indicators */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
              Maintainability Indicators
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Click any indicator card to open its deep mathematical explanation, evidence, and remediation recipe.
            </p>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Each indicator contributes 25% to overall CMDI
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          {indicators.map((ind) => (
            <Card
              key={ind.id}
              elevated
              onClick={() => setSelectedIndicator(ind)}
              style={{
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
              }}
              className="interactive-indicator-card"
            >
              <CardBody style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {indicatorIcons[ind.id]}
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                        {ind.name}
                      </span>
                    </div>
                    <Badge variant={ind.severity}>
                      {ind.severity.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Raw measurement vs Normalized Risk */}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 'var(--space-xs)' }}>
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Raw Measurement
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                        {ind.rawMetric}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Risk Sub-Score
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-severity-critical)' }}>
                        {ind.normalizedRisk} <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>/ 100</span>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: '1.4', marginTop: 'var(--space-xs)' }}>
                    {ind.interpretation}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent-primary)' }}>
                    +{ind.contribution} pts to CMDI
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <span>Explain</span>
                    <ChevronRight size={12} />
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* 5. Contribution Breakdown & Scoring Formula Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {/* Contribution Breakdown */}
        <Card>
          <CardHeader
            title="CMDI Contribution Breakdown"
            subtitle="Weighted share of maintainability friction by indicator"
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {indicators.map((ind) => {
                const percentOfTotal = Math.round((ind.contribution / summary.cmdi) * 100);
                return (
                  <div key={ind.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                        {ind.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        +{ind.contribution} pts ({percentOfTotal}%)
                      </span>
                    </div>
                    <div className="progress-container" style={{ margin: 0, height: '6px' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${percentOfTotal}%`,
                          background: ind.severity === 'critical' ? 'var(--color-severity-critical)' : 'var(--color-severity-medium)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                <span>Total Composite Debt (CMDI):</span>
                <strong style={{ color: 'var(--color-text-primary)' }}>64.5 / 100</strong>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Scoring Engine Formula */}
        <Card elevated>
          <CardHeader
            title="Scoring Formula & Normalization Model"
            subtitle="Documented calculation methodology"
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', fontSize: 'var(--text-xs)' }}>
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-sm) var(--space-md)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-accent-primary)',
                  textAlign: 'center',
                }}
              >
                CMDI = (0.25 × R_comp) + (0.25 × R_dupl) + (0.25 × R_coup) + (0.25 × R_error)
              </div>

              <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                {summary.formulaDescription}
              </p>

              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-xs)', color: 'var(--color-text-muted)' }}>
                <strong>Key Normalization Rules:</strong>
                <ul style={{ paddingLeft: 'var(--space-md)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <li>Complexity: McCabe &le; 10 = 0 risk; McCabe &ge; 40 = 100 risk.</li>
                  <li>Duplication: 0% = 0 risk; &ge; 25% duplicate lines = 100 risk.</li>
                  <li>Coupling: Normalized direct import instabillity factor (0–100).</li>
                  <li>Error Handling: Heuristic defensive penalty inverted from adherence.</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 6. Recommended Investigation Queue (What to fix first?) */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
              Prioritized Remediation Queue
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Recommended investigation order based on complexity × churn velocity and architectural blast radius.
            </p>
          </div>
          <Badge variant="demo">WHAT TO FIX FIRST</Badge>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {(investigationQueue || []).map((item) => (
            <Card key={item.order}>
              <CardBody style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-full)',
                        background: item.order === 1 ? 'rgba(255, 93, 104, 0.15)' : 'var(--color-surface-elevated)',
                        border: `1px solid ${item.order === 1 ? 'var(--color-severity-critical)' : 'var(--color-border)'}`,
                        color: item.order === 1 ? 'var(--color-severity-critical)' : 'var(--color-text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 'bold',
                        fontSize: 'var(--text-xs)',
                        flexShrink: 0,
                      }}
                    >
                      {item.order}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', margin: 0 }}>
                          {item.title}
                        </h3>
                        <Badge variant={item.order <= 2 ? 'critical' : 'medium'}>
                          {item.priority}
                        </Badge>
                      </div>

                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-accent-primary)', marginTop: '2px' }}>
                        {item.target}
                      </div>

                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                        {item.rationale}
                      </p>

                      <div style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                        <strong>Action: </strong>
                        <span style={{ color: 'var(--color-text-muted)' }}>{item.recommendedStep}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '110px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Est. Effort
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                      {item.estimatedHours} hours
                    </div>
                    <Link
                      to={ROUTES.FINDINGS}
                      style={{ fontSize: '11px', color: 'var(--color-accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '6px' }}
                    >
                      <span>Related Findings</span>
                      <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Indicator Deep Explanation Modal */}
      <IndicatorDetailModal
        indicator={selectedIndicator}
        onClose={() => setSelectedIndicator(null)}
      />
    </div>
  );
}

export default TechnicalDebtPage;
