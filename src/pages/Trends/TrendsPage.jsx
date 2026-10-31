import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  FolderPlus,
  Play,
  HelpCircle,
  Clock,
  ArrowRight,
  Shield,
  Activity,
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

export function TrendsPage() {
  useDocumentTitle('CMDI Historical Trends — CodeSentinel AI');

  const { currentAnalysis, historyRecords, loadDemoAnalysis } = useAnalysis();

  // Extract unique repositories from history records
  const uniqueRepos = useMemo(() => {
    const map = new Map();
    historyRecords.forEach((r) => {
      const url = r.repository?.url;
      const name = r.repository?.name || url;
      if (url && !map.has(url)) {
        map.set(url, { label: name, value: url });
      }
    });
    return Array.from(map.values());
  }, [historyRecords]);

  // Default selected repo to current analysis repository URL
  const [selectedRepoUrl, setSelectedRepoUrl] = useState(() => {
    return currentAnalysis?.repository?.url || (uniqueRepos.length > 0 ? uniqueRepos[0].value : '');
  });

  const [trendsData, setTrendsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Sync selectedRepoUrl if currentAnalysis changes and no repo selected
  useEffect(() => {
    if (currentAnalysis?.repository?.url && !selectedRepoUrl) {
      setSelectedRepoUrl(currentAnalysis.repository.url);
    }
  }, [currentAnalysis, selectedRepoUrl]);

  // Fetch trends when selected repo changes
  useEffect(() => {
    let isCancelled = false;

    if (!selectedRepoUrl) {
      setTrendsData(null);
      return;
    }

    const fetchTrends = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const data = await apiClient.getRepositoryTrends(selectedRepoUrl);
        if (!isCancelled) {
          setTrendsData(data);
        }
      } catch (err) {
        if (!isCancelled) {
          // If offline or test fallback, synthesize trend from local matching history records
          const matching = historyRecords.filter((r) => r.repository?.url === selectedRepoUrl);
          if (matching.length > 0) {
            const sorted = [...matching].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            let prev = null;
            const points = sorted.map((item, idx) => {
              const cmdi = typeof item.summary?.cmdi === 'number' ? item.summary.cmdi : null;
              let delta = null;
              let pct = null;
              let dir = 'baseline';
              if (idx > 0 && cmdi !== null && prev !== null) {
                delta = Math.round((cmdi - prev) * 10) / 10;
                dir = delta < -0.2 ? 'improved' : delta > 0.2 ? 'worsened' : 'unchanged';
                if (prev > 0) pct = Math.round(((cmdi - prev) / prev) * 1000) / 10;
              }
              if (cmdi !== null) prev = cmdi;
              return {
                id: item.id,
                timestamp: item.timestamp,
                display_timestamp: item.displayTimestamp || 'Snapshot',
                cmdi,
                score_available: cmdi !== null,
                risk_category: item.summary?.riskCategory || item.summary?.risk_category || 'Moderate Risk',
                findings_count: item.repository?.findingsCount || 0,
                files_examined: item.repository?.filesExamined || 0,
                delta_from_previous: delta,
                percentage_change: pct,
                trend_direction: dir,
              };
            });

            const valid = points.filter((p) => p.cmdi !== null);
            let overall = 'insufficient_data';
            let net = null;
            if (valid.length >= 2) {
              net = Math.round((valid[valid.length - 1].cmdi - valid[0].cmdi) * 10) / 10;
              overall = net < -0.2 ? 'improved' : net > 0.2 ? 'worsened' : 'unchanged';
            }

            setTrendsData({
              repository_name: matching[0].repository?.name || selectedRepoUrl,
              repository_url: selectedRepoUrl,
              total_analyses: points.length,
              earliest_date: points[0]?.timestamp,
              latest_date: points[points.length - 1]?.timestamp,
              analyses: points,
              overall_trend: overall,
              net_cmdi_delta: net,
              heuristic_disclaimer:
                'The Code Maintainability Debt Index (CMDI) is a project-defined heuristic index, not an industry certified standard.',
            });
          } else {
            setFetchError(err.message || 'Failed to load historical trend data.');
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchTrends();

    return () => {
      isCancelled = true;
    };
  }, [selectedRepoUrl, historyRecords]);

  // If no analysis is loaded and no history exists
  if (!currentAnalysis && historyRecords.length === 0) {
    return (
      <div>
        <PageHeader
          title="CMDI Historical Trends"
          icon={<TrendingUp size={24} />}
          description="Track code maintainability index trajectory, measure progress across iterations, and detect architectural regressions."
        />
        <div style={{ maxWidth: '680px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
            title="No Analysis History Available"
            description="To generate maintainability trend timelines, analyze a GitHub repository or load the demonstration environment."
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

  const analysesList = trendsData?.analyses || [];
  const validPoints = analysesList.filter((a) => typeof a.cmdi === 'number');

  // SVG Chart rendering calculation
  const chartHeight = 220;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 30;

  const pointsCoords = useMemo(() => {
    if (analysesList.length === 0) return [];
    const count = analysesList.length;
    const stepX = count > 1 ? (chartWidth - paddingX * 2) / (count - 1) : 0;

    return analysesList.map((item, idx) => {
      const x = count === 1 ? chartWidth / 2 : paddingX + idx * stepX;
      // CMDI is 0 to 100, invert Y so 0 is at bottom and 100 is at top
      const val = typeof item.cmdi === 'number' ? item.cmdi : null;
      const y = val !== null ? chartHeight - paddingY - (val / 100) * (chartHeight - paddingY * 2) : null;
      return { x, y, val, item };
    });
  }, [analysesList, chartWidth, chartHeight, paddingX, paddingY]);

  // Generate SVG path segments (excluding nulls without drawing false lines)
  const linePathSegments = useMemo(() => {
    const segments = [];
    let currentSegment = [];

    pointsCoords.forEach((pt) => {
      if (pt.y !== null) {
        currentSegment.push(pt);
      } else {
        if (currentSegment.length > 1) {
          segments.push(currentSegment);
        }
        currentSegment = [];
      }
    });
    if (currentSegment.length > 1) {
      segments.push(currentSegment);
    }

    return segments.map((seg) => {
      return seg.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    });
  }, [pointsCoords]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* 1. Header */}
      <PageHeader
        title="CMDI Historical Trends"
        icon={<TrendingUp size={24} />}
        description="Track code maintainability debt index trajectory, quantify improvement rates, and catch maintainability regressions over time."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            {uniqueRepos.length > 1 && (
              <div style={{ minWidth: '240px' }}>
                <Select
                  value={selectedRepoUrl}
                  onChange={(e) => setSelectedRepoUrl(e.target.value)}
                  options={uniqueRepos}
                  ariaLabel="Select repository for trend analysis"
                />
              </div>
            )}
            <Button to={ROUTES.COMPARE} variant="secondary" icon={<Sparkles size={14} />}>
              Compare Snapshots
            </Button>
          </div>
        }
      />

      {/* 2. Top Summary Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        <Card>
          <CardBody style={{ padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              TOTAL ANALYSES TRACED
            </div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {trendsData ? trendsData.total_analyses : '—'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Persisted in database
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              OVERALL CMDI TRAJECTORY
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              {trendsData?.overall_trend === 'improved' && (
                <>
                  <TrendingDown size={24} color="var(--color-accent-primary)" />
                  <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-accent-primary)' }}>
                    Improving
                  </span>
                </>
              )}
              {trendsData?.overall_trend === 'worsened' && (
                <>
                  <TrendingUp size={24} color="var(--color-severity-critical)" />
                  <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-severity-critical)' }}>
                    Regressing
                  </span>
                </>
              )}
              {trendsData?.overall_trend === 'unchanged' && (
                <>
                  <Minus size={24} color="var(--color-text-muted)" />
                  <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Stable
                  </span>
                </>
              )}
              {(!trendsData || trendsData?.overall_trend === 'insufficient_data') && (
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Baseline Active
                </span>
              )}
              {trendsData?.overall_trend === 'unavailable' && (
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Score Unavailable
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {trendsData?.net_cmdi_delta !== null && trendsData?.net_cmdi_delta !== undefined
                ? `Net delta: ${trendsData.net_cmdi_delta > 0 ? '+' : ''}${trendsData.net_cmdi_delta} points`
                : 'Need ≥2 snapshots with valid CMDI'}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              EARLIEST SNAPSHOT
            </div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {trendsData?.earliest_date ? new Date(trendsData.earliest_date).toLocaleDateString() : '—'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {trendsData?.earliest_date ? new Date(trendsData.earliest_date).toLocaleTimeString() : 'No date recorded'}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              LATEST SNAPSHOT
            </div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {trendsData?.latest_date ? new Date(trendsData.latest_date).toLocaleDateString() : '—'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {trendsData?.latest_date ? new Date(trendsData.latest_date).toLocaleTimeString() : 'No date recorded'}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 3. Interactive CMDI Trend Chart */}
      <Card>
        <CardHeader
          title="Chronological Maintainability Index Curve"
          action={
            <Badge variant="outline">
              <Sparkles size={11} />
              <span>Project-Defined Heuristic</span>
            </Badge>
          }
        />
        <CardBody style={{ padding: 'var(--space-xl)' }}>
          {isLoading ? (
            <div style={{ padding: 'var(--space-2xl) 0', textAlign: 'center' }}>
              <LoadingState message="Querying chronological trend records..." />
            </div>
          ) : fetchError ? (
            <ErrorMessage message={fetchError} />
          ) : analysesList.length === 0 ? (
            <div style={{ padding: 'var(--space-xl) 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No historical analysis runs found for this repository.
            </div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                style={{
                  width: '100%',
                  maxWidth: `${chartWidth}px`,
                  height: 'auto',
                  display: 'block',
                  margin: '0 auto',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Horizontal Guide Lines */}
                {[0, 25, 50, 75, 100].map((level) => {
                  const y = chartHeight - paddingY - (level / 100) * (chartHeight - paddingY * 2);
                  return (
                    <g key={level}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={chartWidth - paddingX}
                        y2={y}
                        stroke="var(--color-border)"
                        strokeDasharray={level === 0 || level === 100 ? 'none' : '3 3'}
                        strokeWidth="1"
                      />
                      <text
                        x={paddingX - 8}
                        y={y + 4}
                        fill="var(--color-text-muted)"
                        fontSize="10"
                        textAnchor="end"
                        fontFamily="var(--font-mono)"
                      >
                        {level}
                      </text>
                    </g>
                  );
                })}

                {/* Risk Category Zones */}
                <text x={chartWidth - paddingX} y={paddingY + 12} fill="rgba(239, 68, 68, 0.4)" fontSize="9" textAnchor="end">
                  Critical Risk (76–100)
                </text>
                <text x={chartWidth - paddingX} y={paddingY + 45} fill="rgba(234, 179, 8, 0.4)" fontSize="9" textAnchor="end">
                  High Risk (51–75)
                </text>
                <text x={chartWidth - paddingX} y={paddingY + 95} fill="rgba(59, 130, 246, 0.4)" fontSize="9" textAnchor="end">
                  Moderate (26–50)
                </text>
                <text x={chartWidth - paddingX} y={chartHeight - paddingY - 10} fill="rgba(34, 197, 94, 0.4)" fontSize="9" textAnchor="end">
                  Low Risk (0–25)
                </text>

                {/* Trend Lines */}
                {linePathSegments.map((d, idx) => (
                  <path
                    key={idx}
                    d={d}
                    fill="none"
                    stroke="var(--color-accent-primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {/* Data Points */}
                {pointsCoords.map((pt, idx) => {
                  if (pt.y === null) {
                    return (
                      <g key={idx}>
                        <text
                          x={pt.x}
                          y={chartHeight / 2}
                          fill="var(--color-text-muted)"
                          fontSize="9"
                          textAnchor="middle"
                        >
                          N/A
                        </text>
                      </g>
                    );
                  }
                  const tier = getCmdiTier(pt.val);
                  return (
                    <g key={idx}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5"
                        fill="var(--color-surface)"
                        stroke={tier.color}
                        strokeWidth="2.5"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 10}
                        fill="var(--color-text-primary)"
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                        fontFamily="var(--font-mono)"
                      >
                        {pt.val.toFixed(1)}
                      </text>
                      <text
                        x={pt.x}
                        y={chartHeight - 8}
                        fill="var(--color-text-muted)"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        #{idx + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 'var(--space-sm)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span>Earliest Run (#1)</span>
                <span>Chronological Sequence (Oldest to Newest)</span>
                <span>Latest Run (#{analysesList.length})</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 4. Chronological Snapshot Table */}
      <Card>
        <CardHeader
          title="Analysis History Log"
          subtitle="Detailed chronological breakdown of each analysis snapshot"
        />
        <CardBody style={{ padding: 0 }}>
          <Table>
            <thead>
              <tr>
                <th>Run #</th>
                <th>Timestamp</th>
                <th>CMDI Score</th>
                <th>Risk Category</th>
                <th>Findings</th>
                <th>Files</th>
                <th>Delta</th>
                <th>Trajectory</th>
              </tr>
            </thead>
            <tbody>
              {analysesList.map((item, idx) => {
                const tier = typeof item.cmdi === 'number' ? getCmdiTier(item.cmdi) : getCmdiTier(null);
                return (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>#{idx + 1}</td>
                    <td>
                      <div>{item.display_timestamp || 'Snapshot'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                      </div>
                    </td>
                    <td>
                      {item.score_available && typeof item.cmdi === 'number' ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: tier.color }}>
                          {item.cmdi.toFixed(1)} / 100
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Not Available</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={tier.severity}>{item.risk_category || 'Moderate Risk'}</Badge>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.findings_count ?? 0}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.files_examined ?? 0}</td>
                    <td>
                      {item.delta_from_previous !== null && item.delta_from_previous !== undefined ? (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color:
                              item.delta_from_previous < -0.2
                                ? 'var(--color-accent-primary)'
                                : item.delta_from_previous > 0.2
                                ? 'var(--color-severity-critical)'
                                : 'var(--color-text-muted)',
                          }}
                        >
                          {item.delta_from_previous > 0 ? '+' : ''}
                          {item.delta_from_previous}
                          {item.percentage_change !== null ? ` (${item.percentage_change > 0 ? '+' : ''}${item.percentage_change}%)` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {item.trend_direction === 'improved' && (
                        <Badge variant="success">
                          <TrendingDown size={11} />
                          <span>Improved</span>
                        </Badge>
                      )}
                      {item.trend_direction === 'worsened' && (
                        <Badge variant="critical">
                          <TrendingUp size={11} />
                          <span>Worsened</span>
                        </Badge>
                      )}
                      {item.trend_direction === 'unchanged' && (
                        <Badge variant="outline">
                          <Minus size={11} />
                          <span>Unchanged</span>
                        </Badge>
                      )}
                      {item.trend_direction === 'baseline' && (
                        <Badge variant="outline">
                          <span>Baseline</span>
                        </Badge>
                      )}
                      {item.trend_direction === 'unavailable' && (
                        <Badge variant="outline">
                          <span>N/A</span>
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      {/* 5. Heuristic Methodology Disclaimer Notice */}
      <div
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Methodology Notice: </span>
        The Code Maintainability Debt Index (CMDI) is a project-defined heuristic index designed for CodeSentinel AI, not an industry certified or universal standard.
        Score trajectories represent relative composite shifts across static complexity, duplication, architectural coupling, and error-handling indicators.
        Percentages and deltas are computed strictly between comparable reports with verified metric availability.
      </div>
    </div>
  );
}

export default TrendsPage;
