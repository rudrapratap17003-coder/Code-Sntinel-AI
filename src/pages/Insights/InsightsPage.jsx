import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Lightbulb,
  Flame,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FolderPlus,
  Play,
  Sparkles,
  ArrowRight,
  Shield,
  Activity,
  Layers,
  Network,
  Cpu,
  Info,
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

export function InsightsPage() {
  useDocumentTitle('Architecture Hotspots & Pattern Insights — CodeSentinel AI');

  const { currentAnalysis, loadDemoAnalysis } = useAnalysis();

  const [activeTab, setActiveTab] = useState('hotspots'); // 'hotspots' | 'patterns'
  const [rankedHotspots, setRankedHotspots] = useState([]);
  const [patternInsights, setPatternInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sorting state for Module Hotspots Table
  const [sortField, setSortField] = useState('risk'); // 'risk' | 'findings' | 'complexity' | 'coupling'
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!currentAnalysis?.id) {
      setRankedHotspots([]);
      setPatternInsights([]);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [hotspotsRes, patternsRes] = await Promise.all([
          apiClient.getModuleHotspotsRanking(currentAnalysis.id),
          apiClient.getPatternInsights(currentAnalysis.id),
        ]);
        if (!isCancelled) {
          setRankedHotspots(hotspotsRes || []);
          setPatternInsights(patternsRes || []);
        }
      } catch (err) {
        if (!isCancelled) {
          // If offline, synthesize fallback ranking from currentAnalysis
          const nodes = currentAnalysis.architecture?.nodes || [];
          const synth = nodes.map((n) => {
            const afferent = n.afferent_coupling ?? n.afferentCoupling ?? 0;
            const efferent = n.efferent_coupling ?? n.efferentCoupling ?? 0;
            const comp = n.complexity ?? 1;
            const isCrit = n.inCircularCycle || comp >= 20 || afferent >= 4;
            const classification = isCrit ? 'Critical Hotspot' : comp >= 10 ? 'High Risk Hotspot' : 'Stable Module';
            return {
              module_name: n.full_path || n.fullPath || n.label,
              findings_count: currentAnalysis.findings?.filter((f) => f.file === (n.full_path || n.label)).length || 0,
              severity_distribution: { critical: 0, high: 0, medium: 0, low: 0 },
              highest_cyclomatic_complexity: comp,
              total_cyclomatic_complexity: comp,
              loc: n.loc || 0,
              afferent_coupling: afferent,
              efferent_coupling: efferent,
              instability: n.instability || 0.5,
              in_circular_cycle: Boolean(n.inCircularCycle),
              duplicate_lines: 0,
              error_violations_count: 0,
              overall_hotspot_classification: classification,
              why_it_matters: `Module metrics: complexity=${comp}, incoming callers=${afferent}.`,
              associated_finding_ids: [],
            };
          });
          setRankedHotspots(synth);
          setPatternInsights([
            {
              id: 'PAT-ERR-001',
              pattern_name: 'Defensive Exception Over-Catching & Silent Suppression',
              detected: currentAnalysis.findings?.some((f) => f.category?.includes('Error') || f.ruleId?.includes('except')) || false,
              detected_evidence: 'Evaluated error handling from active analysis findings.',
              affected_files: [],
              possible_interpretation: 'Broad try/except blocks may mask unexpected runtime faults.',
              actionable_recommendation: 'Target specific exception classes and log failures.',
              non_authorship_caveat: 'This pattern may be associated with AI-assisted development workflows, but it cannot establish authorship.',
            },
            {
              id: 'PAT-DUP-002',
              pattern_name: 'Repetitive Boilerplate & Unconsolidated Code Clones',
              detected: currentAnalysis.findings?.some((f) => f.category?.includes('Duplication') || f.ruleId?.includes('clone')) || false,
              detected_evidence: 'Evaluated code clone findings.',
              affected_files: [],
              possible_interpretation: 'Independent generation of self-contained functions creates duplicated boilerplate.',
              actionable_recommendation: 'Extract common helpers into shared utility modules.',
              non_authorship_caveat: 'This pattern may be associated with AI-assisted development workflows, but it cannot establish authorship.',
            },
          ]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [currentAnalysis?.id]);

  if (!currentAnalysis) {
    return (
      <div>
        <PageHeader
          title="Insights & Hotspots"
          icon={<Lightbulb size={24} />}
          description="Synthesized module-level hotspot ranking and AI-assisted maintainability pattern intelligence."
        />
        <div style={{ maxWidth: '680px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
            title="No Analysis Selected"
            description="Select or run a repository analysis to explore module hotspots and architectural pattern insights."
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

  // Sorted module hotspots
  const sortedHotspots = [...rankedHotspots].sort((a, b) => {
    const tierWeight = { 'Critical Hotspot': 4, 'High Risk Hotspot': 3, 'Moderate Risk': 2, 'Stable Module': 1 };
    let cmp = 0;
    if (sortField === 'risk') {
      cmp = (tierWeight[b.overall_hotspot_classification] || 1) - (tierWeight[a.overall_hotspot_classification] || 1);
    } else if (sortField === 'findings') {
      cmp = b.findings_count - a.findings_count;
    } else if (sortField === 'complexity') {
      cmp = b.highest_cyclomatic_complexity - a.highest_cyclomatic_complexity;
    } else if (sortField === 'coupling') {
      cmp = b.afferent_coupling - a.afferent_coupling;
    }
    return sortAsc ? -cmp : cmp;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* 1. Header */}
      <PageHeader
        title="Architecture Hotspots & Pattern Insights"
        icon={<Lightbulb size={24} />}
        description="Module-level friction rankings and pattern intelligence to triage architectural debt and improve code maintainability."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Badge variant="outline">
              <Sparkles size={11} />
              <span>{currentAnalysis.repository?.name || 'Active Repo'}</span>
            </Badge>
            <Button to={ROUTES.FINDINGS} variant="secondary" iconEnd={<ArrowRight size={14} />}>
              Findings Ledger
            </Button>
          </div>
        }
      />

      {/* 2. Top Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)' }}>
        <button
          onClick={() => setActiveTab('hotspots')}
          style={{
            padding: '8px 18px',
            background: activeTab === 'hotspots' ? 'var(--color-surface-elevated)' : 'transparent',
            color: activeTab === 'hotspots' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
            border: '1px solid',
            borderColor: activeTab === 'hotspots' ? 'var(--color-border)' : 'transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Flame size={16} />
          <span>Module Hotspot Ranking ({rankedHotspots.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('patterns')}
          style={{
            padding: '8px 18px',
            background: activeTab === 'patterns' ? 'var(--color-surface-elevated)' : 'transparent',
            color: activeTab === 'patterns' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
            border: '1px solid',
            borderColor: activeTab === 'patterns' ? 'var(--color-border)' : 'transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Cpu size={16} />
          <span>AI-Assisted Maintainability Patterns ({patternInsights.filter((p) => p.detected).length} Detected)</span>
        </button>
      </div>

      {isLoading && (
        <div style={{ padding: 'var(--space-2xl) 0', textAlign: 'center' }}>
          <LoadingState message="Evaluating module metrics and architectural patterns..." />
        </div>
      )}

      {errorMsg && !isLoading && <ErrorMessage message={errorMsg} />}

      {/* TAB A: Module Hotspot Ranking */}
      {!isLoading && activeTab === 'hotspots' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <Card>
            <CardHeader
              title="Codebase Module Hotspot Ranking"
              subtitle="Ranks modules combining function complexity, caller coupling blast radius, circular dependencies, and error violations."
            />
            <CardBody style={{ padding: 0 }}>
              <Table>
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('risk')}>
                      Classification {sortField === 'risk' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th>Module Name</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('findings')}>
                      Findings {sortField === 'findings' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('complexity')}>
                      Peak Complexity {sortField === 'complexity' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('coupling')}>
                      Coupling (Ca / Ce) {sortField === 'coupling' ? (sortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th>Circular Loop</th>
                    <th>Rationale & Blast Radius</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHotspots.map((mod, idx) => {
                    let badgeVar = 'outline';
                    if (mod.overall_hotspot_classification === 'Critical Hotspot') badgeVar = 'critical';
                    else if (mod.overall_hotspot_classification === 'High Risk Hotspot') badgeVar = 'warning';
                    else if (mod.overall_hotspot_classification === 'Moderate Risk') badgeVar = 'medium';

                    return (
                      <tr key={idx}>
                        <td>
                          <Badge variant={badgeVar}>{mod.overall_hotspot_classification}</Badge>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                          {mod.module_name}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          <span style={{ fontWeight: 600 }}>{mod.findings_count}</span>
                          {mod.severity_distribution?.critical > 0 && (
                            <span style={{ color: 'var(--color-severity-critical)', marginLeft: '4px', fontSize: '10px' }}>
                              ({mod.severity_distribution.critical} crit)
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          <span
                            style={{
                              color:
                                mod.highest_cyclomatic_complexity >= 20
                                  ? 'var(--color-severity-critical)'
                                  : mod.highest_cyclomatic_complexity >= 10
                                  ? 'var(--color-severity-medium)'
                                  : 'inherit',
                            }}
                          >
                            {mod.highest_cyclomatic_complexity}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {mod.afferent_coupling} in / {mod.efferent_coupling} out
                        </td>
                        <td>
                          {mod.in_circular_cycle ? (
                            <Badge variant="critical">Yes (Loop)</Badge>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>No</span>
                          )}
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', maxWidth: '320px' }}>
                          {mod.why_it_matters}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB B: AI-Assisted Pattern Insights */}
      {!isLoading && activeTab === 'patterns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Strict Non-Authorship Global Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-md)',
              padding: 'var(--space-md) var(--space-lg)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <Info size={18} color="var(--color-severity-info)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontWeight: 600 }}>Pattern Intelligence Disclaimer: </span>
              These maintainability patterns are architectural indicators frequently observed in AI-assisted workflows
              (such as iterative code generation, localized prompt edits, and defensive exception handling).
              <span style={{ fontWeight: 600, display: 'block', marginTop: '4px' }}>
                They reflect structural code patterns, not proof of AI authorship. CodeSentinel AI evaluates code maintainability, never author identity.
              </span>
            </div>
          </div>

          {/* Pattern Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-lg)' }}>
            {patternInsights.map((pat) => (
              <Card
                key={pat.id}
                style={{
                  borderLeft: `4px solid ${pat.detected ? 'var(--color-severity-critical)' : 'var(--color-accent-primary)'}`,
                }}
              >
                <CardHeader
                  title={pat.pattern_name}
                  action={
                    pat.detected ? (
                      <Badge variant="critical">Pattern Detected</Badge>
                    ) : (
                      <Badge variant="success">Not Detected</Badge>
                    )
                  }
                />
                <CardBody style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {/* Evidence */}
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      DETECTED EVIDENCE
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                      {pat.detected_evidence}
                    </div>
                    {pat.affected_files && pat.affected_files.length > 0 && (
                      <div style={{ marginTop: '6px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                        Affected files: {pat.affected_files.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Possible Interpretation */}
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      ARCHITECTURAL INTERPRETATION
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {pat.possible_interpretation}
                    </div>
                  </div>

                  {/* Actionable Recommendation */}
                  <div
                    style={{
                      padding: 'var(--space-sm) var(--space-md)',
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-accent-primary)', marginBottom: '2px' }}>
                      ACTIONABLE RECOMMENDATION
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                      {pat.actionable_recommendation}
                    </div>
                  </div>

                  {/* Non-Authorship Footnote */}
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: '6px' }}>
                    {pat.non_authorship_caveat}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default InsightsPage;
