import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Sparkles,
  Shield,
  Flame,
  Activity,
  Layers,
  Network,
  AlertTriangle,
  FolderPlus,
  Play,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  Calendar,
  GitBranch,
  ExternalLink,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  EmptyState,
  LoadingState,
  ErrorMessage,
  Table,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiClient } from '../../api';
import { ROUTES } from '../../utils/constants';
import { getCmdiTier } from '../../utils/scoringEngine';

export function ReportPage() {
  useDocumentTitle('Developer Improvement Report — CodeSentinel AI');

  const { currentAnalysis, loadDemoAnalysis } = useAnalysis();

  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    if (!currentAnalysis?.id) {
      setReportData(null);
      return;
    }

    const fetchReport = async () => {
      setIsLoading(true);
      setReportError(null);
      try {
        const data = await apiClient.getDeveloperReport(currentAnalysis.id);
        if (!isCancelled) {
          setReportData(data);
        }
      } catch (err) {
        if (!isCancelled) {
          // Synthesize report fallback if backend unreachable
          setReportData({
            repository_name: currentAnalysis.repository?.name || 'Current Repository',
            repository_url: currentAnalysis.repository?.url || '',
            analysis_date: currentAnalysis.timestamp,
            display_date: currentAnalysis.displayTimestamp || 'Snapshot',
            commit_hash: currentAnalysis.repository?.commitHash || null,
            branch: currentAnalysis.repository?.branch || 'main',
            cmdi: currentAnalysis.summary?.cmdi ?? null,
            score_available: currentAnalysis.summary?.scoreAvailable !== false,
            risk_category: currentAnalysis.summary?.riskCategory || 'Moderate Risk',
            risk_severity: currentAnalysis.summary?.riskSeverity || 'info',
            indicator_summary: currentAnalysis.indicators || [],
            total_findings: currentAnalysis.findings?.length || 0,
            critical_findings_count: currentAnalysis.findings?.filter((f) => f.severity === 'critical').length || 0,
            high_findings_count: currentAnalysis.findings?.filter((f) => f.severity === 'high').length || 0,
            prioritized_findings: (currentAnalysis.priorityFindings || []).slice(0, 8),
            main_hotspots: (currentAnalysis.hotspots || []).slice(0, 5),
            pattern_insights: [],
            historical_trend_summary: null,
            recommended_next_steps: [
              'Triage critical and high-priority architectural findings.',
              'Decompose modules with high function complexity.',
              'Establish continuous automated regression scanning.',
            ],
            data_provenance_notes: [
              'Static AST measurements computed deterministically.',
              'CMDI is a project-defined heuristic index, not an industry certified standard.',
            ],
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchReport();

    return () => {
      isCancelled = true;
    };
  }, [currentAnalysis?.id]);

  const handlePrint = () => {
    window.print();
  };

  if (!currentAnalysis) {
    return (
      <div>
        <PageHeader
          title="Developer Improvement Report"
          icon={<FileText size={24} />}
          description="Executive summary and engineering roadmap for technical-debt reduction."
        />
        <div style={{ maxWidth: '680px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
            title="No Analysis Selected"
            description="Select or run a repository analysis to generate an executive improvement report."
            action={
              <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                <Button variant="primary" icon={<Sparkles size={16} />} onClick={loadDemoAnalysis}>
                  Load Demonstration Analysis
                </Button>
                <Button to={ROUTES.REPOSITORY} variant="secondary" icon={<Play size={16} />}>
                  Analyze Repository
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const tier = reportData?.cmdi !== null && reportData?.cmdi !== undefined ? getCmdiTier(reportData.cmdi) : getCmdiTier(null);

  return (
    <div className="developer-report-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* 1. Page Header (Hidden when printing via CSS) */}
      <div className="no-print">
        <PageHeader
          title="Developer Improvement Report"
          icon={<FileText size={24} />}
          description="Executive summary combining measured AST data, heuristic debt scoring, prioritized refactoring targets, and an engineering remediation roadmap."
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <Button variant="primary" icon={<Printer size={16} />} onClick={handlePrint}>
                Print / Save as PDF
              </Button>
            </div>
          }
        />
      </div>

      {isLoading && (
        <div style={{ padding: 'var(--space-2xl) 0', textAlign: 'center' }}>
          <LoadingState message="Compiling executive developer improvement report..." />
        </div>
      )}

      {reportError && !isLoading && <ErrorMessage message={reportError} />}

      {/* 2. Printable Report Body */}
      {reportData && !isLoading && (
        <div
          id="printable-report"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-2xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2xl)',
          }}
        >
          {/* Report Header & Metadata Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid var(--color-border)',
              paddingBottom: 'var(--space-xl)',
              flexWrap: 'wrap',
              gap: 'var(--space-lg)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Shield size={22} color="var(--color-accent-primary)" />
                <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, letterSpacing: '0.05em' }}>
                  CODESENTINEL <span style={{ color: 'var(--color-accent-primary)' }}>AI</span>
                </span>
                <Badge variant="outline">TECHNICAL DEBT AUDIT</Badge>
              </div>
              <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: '4px 0' }}>
                {reportData.repository_name}
              </h1>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {reportData.repository_url}
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '180px' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>ANALYSIS DATE</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                {reportData.analysis_date ? new Date(reportData.analysis_date).toLocaleString() : reportData.display_date}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Branch: {reportData.branch}
                {reportData.commit_hash ? ` • commit ${reportData.commit_hash.slice(0, 7)}` : ''}
              </div>
            </div>
          </div>

          {/* Section A: CMDI & Debt Overview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-lg)',
              padding: 'var(--space-xl)',
              background: 'var(--color-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${tier.color}`,
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                COMPOSITE CMDI DEBT SCORE
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: tier.color }}>
                {reportData.cmdi !== null ? `${reportData.cmdi.toFixed(1)} / 100` : 'Not Available'}
              </div>
              <div style={{ marginTop: '6px' }}>
                <Badge variant={tier.severity}>{reportData.risk_category}</Badge>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                TOTAL FINDINGS
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {reportData.total_findings}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {reportData.critical_findings_count} critical, {reportData.high_findings_count} high priority
              </div>
            </div>

            {reportData.historical_trend_summary && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  HISTORICAL TRAJECTORY
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-accent-primary)' }}>
                  {reportData.historical_trend_summary.overall_trend?.toUpperCase()}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {reportData.historical_trend_summary.total_historical_runs} runs logged
                </div>
              </div>
            )}
          </div>

          {/* Section B: Actionable Remediation Roadmap */}
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="var(--color-accent-primary)" />
              Recommended Next Engineering Steps
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: 'var(--space-lg)',
                background: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              {reportData.recommended_next_steps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section C: Prioritized Technical Debt Findings */}
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="var(--color-severity-critical)" />
              High-Priority Technical Debt Findings
            </h2>
            {reportData.prioritized_findings.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                No open high-priority findings detected.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Priority Tier</th>
                    <th>Score</th>
                    <th>Finding Title</th>
                    <th>File Coordinate</th>
                    <th>Recommended Remediation</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.prioritized_findings.map((f, idx) => (
                    <tr key={idx}>
                      <td>
                        <Badge
                          variant={
                            f.priority_tier === 'Critical Attention'
                              ? 'critical'
                              : f.priority_tier === 'High Priority'
                              ? 'warning'
                              : 'medium'
                          }
                        >
                          {f.priority_tier}
                        </Badge>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{f.priority_score ?? '—'}/100</td>
                      <td style={{ fontWeight: 600 }}>{f.title}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                        {f.file} ({f.line_range})
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', maxWidth: '300px' }}>
                        {f.recommended_next_action || f.refactoring_guidance?.recommended_change}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>

          {/* Section D: Top Architectural Hotspots */}
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="var(--color-severity-critical)" />
              Top Architectural Hotspots
            </h2>
            {reportData.main_hotspots.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                No architectural hotspots identified.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Classification</th>
                    <th>Module</th>
                    <th>Complexity</th>
                    <th>Coupling (In/Out)</th>
                    <th>Findings</th>
                    <th>Hotspot Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.main_hotspots.map((h, idx) => (
                    <tr key={idx}>
                      <td>
                        <Badge
                          variant={
                            h.overall_hotspot_classification === 'Critical Hotspot'
                              ? 'critical'
                              : h.overall_hotspot_classification === 'High Risk Hotspot'
                              ? 'warning'
                              : 'medium'
                          }
                        >
                          {h.overall_hotspot_classification}
                        </Badge>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        {h.module_name || h.file}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{h.highest_cyclomatic_complexity || h.complexity}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {h.afferent_coupling} in / {h.efferent_coupling} out
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{h.findings_count}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', maxWidth: '300px' }}>
                        {h.why_it_matters}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>

          {/* Section E: Data Provenance & Methodology Disclaimers */}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-lg)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Data Provenance & Methodology Disclosure:
            </div>
            <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
              {reportData.data_provenance_notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
              <li>
                Maintainability pattern insights and priority recommendations are engineering heuristics intended to guide human refactoring reviews.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportPage;
