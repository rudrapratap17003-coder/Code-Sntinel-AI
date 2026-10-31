import React, { useState, useEffect, useMemo } from 'react';
import {
  GitCompare,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FolderPlus,
  Play,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Activity,
  Network,
  Clock,
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
  Select,
  LoadingState,
  ErrorMessage,
  Table,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiClient } from '../../api';
import { ROUTES } from '../../utils/constants';
import { getCmdiTier } from '../../utils/scoringEngine';

export function ComparePage() {
  useDocumentTitle('Snapshot Comparison — CodeSentinel AI');

  const { currentAnalysis, historyRecords, loadDemoAnalysis } = useAnalysis();

  // Group history records by normalized repository URL
  const reposMap = useMemo(() => {
    const map = new Map();
    historyRecords.forEach((r) => {
      const url = r.repository?.url;
      if (url) {
        if (!map.has(url)) {
          map.set(url, {
            name: r.repository?.name || url,
            records: [],
          });
        }
        map.get(url).records.push(r);
      }
    });
    return map;
  }, [historyRecords]);

  const repoOptions = useMemo(() => {
    return Array.from(reposMap.entries()).map(([url, data]) => ({
      label: `${data.name} (${data.records.length} runs)`,
      value: url,
    }));
  }, [reposMap]);

  // Selected Repository
  const [selectedRepoUrl, setSelectedRepoUrl] = useState(() => {
    return currentAnalysis?.repository?.url || (repoOptions.length > 0 ? repoOptions[0].value : '');
  });

  // Candidate runs for the chosen repository
  const candidateRuns = useMemo(() => {
    if (!selectedRepoUrl || !reposMap.has(selectedRepoUrl)) return [];
    const list = [...reposMap.get(selectedRepoUrl).records];
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return list;
  }, [selectedRepoUrl, reposMap]);

  // Snapshot Selection
  const [baseId, setBaseId] = useState('');
  const [targetId, setTargetId] = useState('');

  // Auto-select latest 2 runs when candidateRuns change
  useEffect(() => {
    if (candidateRuns.length >= 2) {
      setBaseId(candidateRuns[1].id);
      setTargetId(candidateRuns[0].id);
    } else if (candidateRuns.length === 1) {
      setBaseId(candidateRuns[0].id);
      setTargetId(candidateRuns[0].id);
    } else {
      setBaseId('');
      setTargetId('');
    }
  }, [candidateRuns]);

  const [comparisonResult, setComparisonResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'findings' | 'indicators' | 'modules'

  // Trigger comparison when baseId and targetId are ready
  const performComparison = async () => {
    if (!baseId || !targetId) return;

    if (baseId === targetId) {
      setCompareError('Please select two distinct historical analysis runs to compare.');
      setComparisonResult(null);
      return;
    }

    setIsLoading(true);
    setCompareError(null);

    try {
      const res = await apiClient.compareAnalyses(baseId, targetId);
      setComparisonResult(res);
    } catch (err) {
      setCompareError(err.message || 'Comparison between selected snapshots failed.');
      setComparisonResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (baseId && targetId && baseId !== targetId) {
      performComparison();
    }
  }, [baseId, targetId]);

  if (!currentAnalysis && historyRecords.length === 0) {
    return (
      <div>
        <PageHeader
          title="Snapshot Comparison"
          icon={<GitCompare size={24} />}
          description="Compare two historical analysis snapshots side by side to measure improvements and detect regressions."
        />
        <div style={{ maxWidth: '680px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
            title="No Analysis Records Available"
            description="To compare before-and-after snapshots, at least two analyses for a repository must be recorded."
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

  const runOptions = candidateRuns.map((r) => {
    const timeStr = r.displayTimestamp || (r.timestamp ? new Date(r.timestamp).toLocaleDateString() : r.id);
    const scoreStr = r.summary?.scoreAvailable && typeof r.summary?.cmdi === 'number'
      ? `CMDI: ${r.summary.cmdi.toFixed(1)}`
      : 'CMDI: N/A';
    return {
      label: `${timeStr} (${scoreStr}) — ${r.id.slice(0, 8)}`,
      value: r.id,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* 1. Page Header */}
      <PageHeader
        title="Snapshot Comparison"
        icon={<GitCompare size={24} />}
        description="Diff two codebase maintainability analyses: inspect CMDI delta, indicator shifts, newly introduced findings, and resolved hotspots."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Button to={ROUTES.TRENDS} variant="secondary" icon={<TrendingUp size={14} />}>
              View Full Trend
            </Button>
          </div>
        }
      />

      {/* 2. Selection Bar */}
      <Card>
        <CardBody style={{ padding: 'var(--space-lg)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-md)',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                TARGET REPOSITORY
              </label>
              <Select
                value={selectedRepoUrl}
                onChange={(e) => setSelectedRepoUrl(e.target.value)}
                options={repoOptions}
                ariaLabel="Select repository"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                BASELINE SNAPSHOT (EARLIER)
              </label>
              <Select
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                options={runOptions}
                ariaLabel="Select baseline analysis"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                TARGET SNAPSHOT (LATER)
              </label>
              <Select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                options={runOptions}
                ariaLabel="Select target analysis"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 3. Loading & Error States */}
      {isLoading && (
        <div style={{ padding: 'var(--space-2xl) 0', textAlign: 'center' }}>
          <LoadingState message="Computing differential analysis between selected snapshots..." />
        </div>
      )}

      {compareError && !isLoading && (
        <ErrorMessage message={compareError} />
      )}

      {/* 4. Comparison Results View */}
      {comparisonResult && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {/* Scope Warning Banner if File Count Changed */}
          {comparisonResult.summary?.scope_change_warning && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <AlertTriangle size={18} color="var(--color-severity-medium)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <span style={{ fontWeight: 600 }}>Scope Variation Notice: </span>
                {comparisonResult.summary.scope_change_warning}
              </div>
            </div>
          )}

          {/* Overall CMDI Delta Score Card */}
          <Card
            style={{
              background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%)',
              borderLeft: `4px solid ${
                comparisonResult.cmdi_status === 'improved'
                  ? 'var(--color-accent-primary)'
                  : comparisonResult.cmdi_status === 'regressed'
                  ? 'var(--color-severity-critical)'
                  : 'var(--color-border)'
              }`,
            }}
          >
            <CardBody style={{ padding: 'var(--space-xl)' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--space-xl)',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    BASELINE CMDI (EARLIER)
                  </div>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {comparisonResult.earlier_cmdi !== null ? `${comparisonResult.earlier_cmdi.toFixed(1)} / 100` : 'Not Available'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {new Date(comparisonResult.earlier_timestamp).toLocaleString()}
                    {comparisonResult.earlier_commit ? ` • commit ${comparisonResult.earlier_commit.slice(0, 7)}` : ''}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <Badge variant={getCmdiTier(comparisonResult.earlier_cmdi).severity}>
                      {comparisonResult.earlier_category}
                    </Badge>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    NET SCORE SHIFT
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-3xl)',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color:
                        comparisonResult.cmdi_difference < -0.2
                          ? 'var(--color-accent-primary)'
                          : comparisonResult.cmdi_difference > 0.2
                          ? 'var(--color-severity-critical)'
                          : 'var(--color-text-muted)',
                    }}
                  >
                    {comparisonResult.cmdi_difference !== null
                      ? `${comparisonResult.cmdi_difference > 0 ? '+' : ''}${comparisonResult.cmdi_difference.toFixed(1)}`
                      : '—'}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    {comparisonResult.cmdi_status === 'improved' && (
                      <Badge variant="success">
                        <TrendingDown size={11} />
                        <span>Debt Reduced (Improved)</span>
                      </Badge>
                    )}
                    {comparisonResult.cmdi_status === 'regressed' && (
                      <Badge variant="critical">
                        <TrendingUp size={11} />
                        <span>Debt Increased (Regressed)</span>
                      </Badge>
                    )}
                    {comparisonResult.cmdi_status === 'unchanged' && (
                      <Badge variant="outline">
                        <Minus size={11} />
                        <span>Score Invariant</span>
                      </Badge>
                    )}
                    {comparisonResult.cmdi_status === 'unavailable' && (
                      <Badge variant="outline">
                        <span>Metrics Unavailable</span>
                      </Badge>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    TARGET CMDI (LATER)
                  </div>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {comparisonResult.later_cmdi !== null ? `${comparisonResult.later_cmdi.toFixed(1)} / 100` : 'Not Available'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {new Date(comparisonResult.later_timestamp).toLocaleString()}
                    {comparisonResult.later_commit ? ` • commit ${comparisonResult.later_commit.slice(0, 7)}` : ''}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <Badge variant={getCmdiTier(comparisonResult.later_cmdi).severity}>
                      {comparisonResult.later_category}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Tab Navigation for Detailed Sections */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)' }}>
            {[
              { id: 'summary', label: 'Executive Summary' },
              { id: 'findings', label: `Findings Diff (${comparisonResult.findings.newly_detected.length} new / ${comparisonResult.findings.no_longer_detected.length} resolved)` },
              { id: 'indicators', label: 'Indicator Shift' },
              { id: 'modules', label: `Modules & Hotspots (${comparisonResult.modules.newly_detected_hotspots.length} new hotspots)` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  background: activeTab === tab.id ? 'var(--color-surface-elevated)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                  border: '1px solid',
                  borderColor: activeTab === tab.id ? 'var(--color-border)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 'var(--text-xs)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Executive Summary */}
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-lg)' }}>
              {/* What Improved */}
              <Card>
                <CardHeader title="What Improved" />
                <CardBody style={{ padding: 'var(--space-lg)' }}>
                  {comparisonResult.summary.what_improved.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      No measurable maintainability improvements detected between these snapshots.
                    </div>
                  ) : (
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comparisonResult.summary.what_improved.map((item, idx) => (
                        <li key={idx} style={{ color: 'var(--color-accent-primary)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ color: 'var(--color-text-primary)' }}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              {/* What Worsened */}
              <Card>
                <CardHeader title="What Regressed / Worsened" />
                <CardBody style={{ padding: 'var(--space-lg)' }}>
                  {comparisonResult.summary.what_worsened.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      No maintainability regressions identified between these snapshots.
                    </div>
                  ) : (
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comparisonResult.summary.what_worsened.map((item, idx) => (
                        <li key={idx} style={{ color: 'var(--color-severity-critical)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ color: 'var(--color-text-primary)' }}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              {/* Invariant / Unchanged */}
              <Card>
                <CardHeader title="What Remained Stable / Unchanged" />
                <CardBody style={{ padding: 'var(--space-lg)' }}>
                  {comparisonResult.summary.what_remained_unchanged.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>—</div>
                  ) : (
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comparisonResult.summary.what_remained_unchanged.map((item, idx) => (
                        <li key={idx} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              {/* Next Steps */}
              <Card>
                <CardHeader title="Recommended Next Actions" />
                <CardBody style={{ padding: 'var(--space-lg)' }}>
                  <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {comparisonResult.summary.recommended_next_actions.map((item, idx) => (
                      <li key={idx} style={{ color: 'var(--color-accent-primary)', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          )}

          {/* TAB 2: Findings Diff */}
          {activeTab === 'findings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              {/* Disclaimer */}
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {comparisonResult.findings.disclaimer}
              </div>

              {/* Newly Detected */}
              <Card>
                <CardHeader
                  title={`Newly Detected Findings (${comparisonResult.findings.newly_detected.length})`}
                  subtitle="Issues present in the later analysis that were absent in the baseline"
                />
                <CardBody style={{ padding: 0 }}>
                  {comparisonResult.findings.newly_detected.length === 0 ? (
                    <div style={{ padding: 'var(--space-lg)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      No new maintainability findings were introduced!
                    </div>
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <th>Severity</th>
                          <th>Finding Title</th>
                          <th>Category</th>
                          <th>File Coordinate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResult.findings.newly_detected.map((f, idx) => (
                          <tr key={idx}>
                            <td>
                              <Badge variant={f.later_severity || 'info'}>{f.later_severity}</Badge>
                            </td>
                            <td style={{ fontWeight: 600 }}>{f.title}</td>
                            <td>{f.category}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                              {f.file} ({f.line_range})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>

              {/* No Longer Detected (Resolved) */}
              <Card>
                <CardHeader
                  title={`Findings No Longer Detected (${comparisonResult.findings.no_longer_detected.length})`}
                  subtitle="Issues resolved or absent in the later analysis snapshot"
                />
                <CardBody style={{ padding: 0 }}>
                  {comparisonResult.findings.no_longer_detected.length === 0 ? (
                    <div style={{ padding: 'var(--space-lg)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      No previously detected findings were resolved between these runs.
                    </div>
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <th>Previous Severity</th>
                          <th>Finding Title</th>
                          <th>Category</th>
                          <th>File Coordinate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResult.findings.no_longer_detected.map((f, idx) => (
                          <tr key={idx}>
                            <td>
                              <Badge variant={f.earlier_severity || 'info'}>{f.earlier_severity}</Badge>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--color-accent-primary)' }}>{f.title}</td>
                            <td>{f.category}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                              {f.file} ({f.line_range})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>

              {/* Unresolved */}
              <Card>
                <CardHeader
                  title={`Persistent Unresolved Findings (${comparisonResult.findings.unresolved.length})`}
                  subtitle="Issues that remain active across both snapshots"
                />
                <CardBody style={{ padding: 0 }}>
                  {comparisonResult.findings.unresolved.length === 0 ? (
                    <div style={{ padding: 'var(--space-lg)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      No persistent unresolved findings.
                    </div>
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <th>Severity</th>
                          <th>Finding Title</th>
                          <th>Category</th>
                          <th>File Coordinate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResult.findings.unresolved.slice(0, 15).map((f, idx) => (
                          <tr key={idx}>
                            <td>
                              <Badge variant={f.later_severity || 'info'}>{f.later_severity}</Badge>
                            </td>
                            <td style={{ fontWeight: 500 }}>{f.title}</td>
                            <td>{f.category}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                              {f.file} ({f.line_range})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* TAB 3: Indicator Shift */}
          {activeTab === 'indicators' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-md)',
              }}
            >
              {comparisonResult.indicators.map((ind) => (
                <Card key={ind.id}>
                  <CardHeader
                    title={ind.name}
                    action={
                      ind.status === 'improved' ? (
                        <Badge variant="success">Improved</Badge>
                      ) : ind.status === 'regressed' ? (
                        <Badge variant="critical">Regressed</Badge>
                      ) : (
                        <Badge variant="outline">Invariant</Badge>
                      )
                    }
                  />
                  <CardBody style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Baseline Risk:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {ind.earlier_risk !== null ? `${ind.earlier_risk.toFixed(1)} / 100` : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Target Risk:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {ind.later_risk !== null ? `${ind.later_risk.toFixed(1)} / 100` : 'N/A'}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Risk Delta:</span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color:
                            ind.delta < -0.2
                              ? 'var(--color-accent-primary)'
                              : ind.delta > 0.2
                              ? 'var(--color-severity-critical)'
                              : 'var(--color-text-muted)',
                        }}
                      >
                        {ind.delta !== null ? `${ind.delta > 0 ? '+' : ''}${ind.delta.toFixed(1)} pts` : '—'}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {/* TAB 4: Modules & Hotspots */}
          {activeTab === 'modules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              {/* Hotspot Changes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-md)' }}>
                <Card>
                  <CardHeader title={`Newly Detected Hotspots (${comparisonResult.modules.newly_detected_hotspots.length})`} />
                  <CardBody style={{ padding: 'var(--space-lg)' }}>
                    {comparisonResult.modules.newly_detected_hotspots.length === 0 ? (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        No new architectural hotspots emerged.
                      </div>
                    ) : (
                      <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                        {comparisonResult.modules.newly_detected_hotspots.map((h, idx) => (
                          <li key={idx} style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-severity-critical)', fontSize: 'var(--text-xs)' }}>
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title={`Resolved Hotspots (${comparisonResult.modules.resolved_hotspots.length})`} />
                  <CardBody style={{ padding: 'var(--space-lg)' }}>
                    {comparisonResult.modules.resolved_hotspots.length === 0 ? (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        No previous hotspots were resolved.
                      </div>
                    ) : (
                      <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                        {comparisonResult.modules.resolved_hotspots.map((h, idx) => (
                          <li key={idx} style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent-primary)', fontSize: 'var(--text-xs)' }}>
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardBody>
                </Card>
              </div>

              {/* Module Risk Shifts Table */}
              <Card>
                <CardHeader title="Module Risk Metric Shifts" />
                <CardBody style={{ padding: 0 }}>
                  {comparisonResult.modules.increased_risk_modules.length === 0 &&
                  comparisonResult.modules.reduced_risk_modules.length === 0 ? (
                    <div style={{ padding: 'var(--space-lg)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      Module complexity and coupling metrics remained stable between these snapshots.
                    </div>
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th>Status</th>
                          <th>Complexity Shift</th>
                          <th>Coupling Shift</th>
                          <th>Findings Shift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...comparisonResult.modules.increased_risk_modules,
                          ...comparisonResult.modules.reduced_risk_modules,
                        ].map((mod, idx) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                              {mod.module_name}
                            </td>
                            <td>
                              {mod.status === 'increased_risk' ? (
                                <Badge variant="critical">Risk Increased</Badge>
                              ) : (
                                <Badge variant="success">Risk Reduced</Badge>
                              )}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {mod.earlier_complexity} → {mod.later_complexity}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {mod.earlier_coupling} → {mod.later_coupling}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {mod.earlier_findings} → {mod.later_findings}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ComparePage;
