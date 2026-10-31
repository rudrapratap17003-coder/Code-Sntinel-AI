import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FolderPlus,
  Play,
  X,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardBody,
  Input,
  Select,
  Button,
  Badge,
  Table,
  EmptyState,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { FindingDetailModal } from '../../components/findings/FindingDetailModal';
import { ROUTES } from '../../utils/constants';

const SEVERITY_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const getPriorityTier = (severity) => {
  const s = (severity || '').toLowerCase();
  if (s === 'critical') return { label: 'Critical Attention', variant: 'critical' };
  if (s === 'high') return { label: 'High Priority', variant: 'warning' };
  if (s === 'medium') return { label: 'Medium Priority', variant: 'medium' };
  return { label: 'Low Priority', variant: 'default' };
};

export function FindingsPage() {
  useDocumentTitle('Findings Explorer');
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    currentAnalysis,
    loadDemoAnalysis,
  } = useAnalysis();

  // Filter & Search State
  const initialCategory = searchParams.get('category') || 'all';
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('severity-desc');

  // Debounce search term to prevent expensive filter recalculations on rapid typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal State
  const [activeFinding, setActiveFinding] = useState(null);

  // Sync category filter if URL param changes
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setSelectedCategory(cat);
    }
  }, [searchParams]);

  // If no analysis is loaded, render empty state
  if (!currentAnalysis) {
    return (
      <div>
        <PageHeader
          title="Findings Explorer"
          icon={<ShieldAlert size={24} />}
          description="Search, filter, and inspect line-level maintainability findings, complexity hotspots, and structural debt."
        />

        <div style={{ maxWidth: '720px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
            title="No Codebase Analysis Selected"
            description="To inspect the findings ledger and evidence coordinates, submit a GitHub repository URL or load the demonstration analysis."
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

  const allFindings = currentAnalysis.findings || [];

  // 1. Filter Logic
  const filteredFindings = useMemo(() => {
    return allFindings.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Severity filter
      if (selectedSeverity !== 'all' && item.severity !== selectedSeverity) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false;
      }

      // Search term filter (uses debouncedSearchTerm for fluid UI typing performance)
      if (debouncedSearchTerm.trim()) {
        const query = debouncedSearchTerm.toLowerCase();
        const matchesId = (item.id || '').toLowerCase().includes(query);
        const matchesTitle = (item.title || '').toLowerCase().includes(query);
        const matchesFile = (item.file || '').toLowerCase().includes(query);
        const matchesRule = (item.ruleId || item.rule_id || '').toLowerCase().includes(query);
        const matchesSummary = (item.summary || '').toLowerCase().includes(query);
        if (!matchesId && !matchesTitle && !matchesFile && !matchesRule && !matchesSummary) {
          return false;
        }
      }

      return true;
    });
  }, [allFindings, selectedCategory, selectedSeverity, selectedStatus, debouncedSearchTerm]);

  // Reset pagination to first page when active filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategory, selectedSeverity, selectedStatus, sortBy]);

  // 2. Sort Logic
  const sortedFindings = useMemo(() => {
    const list = [...filteredFindings];
    list.sort((a, b) => {
      if (sortBy === 'severity-desc') {
        return (SEVERITY_WEIGHTS[b.severity] || 0) - (SEVERITY_WEIGHTS[a.severity] || 0);
      }
      if (sortBy === 'severity-asc') {
        return (SEVERITY_WEIGHTS[a.severity] || 0) - (SEVERITY_WEIGHTS[b.severity] || 0);
      }
      if (sortBy === 'id-asc') {
        return (a.id || '').localeCompare(b.id || '');
      }
      if (sortBy === 'file-asc') {
        return (a.file || '').localeCompare(b.file || '');
      }
      if (sortBy === 'category-asc') {
        return (a.category || '').localeCompare(b.category || '');
      }
      if (sortBy === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });
    return list;
  }, [filteredFindings, sortBy]);

  // 3. Pagination Logic
  const totalItems = sortedFindings.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFindings.slice(start, start + pageSize);
  }, [sortedFindings, currentPage, pageSize]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedStatus('all');
    setSortBy('severity-desc');
    setCurrentPage(1);
    setSearchParams({});
  };

  const handleSelectRelatedFinding = (findingId) => {
    const found = allFindings.find((f) => f.id === findingId);
    if (found) {
      setActiveFinding(found);
    }
  };

  // Table Columns with Priority Tier
  const columns = [
    {
      key: 'severity',
      label: 'Severity & Tier',
      width: '130px',
      render: (val) => {
        const variant = {
          critical: 'critical',
          high: 'critical',
          medium: 'medium',
          low: 'demo',
        }[val] || 'default';
        const tier = getPriorityTier(val);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <Badge variant={variant}>{val.toUpperCase()}</Badge>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              {tier.label}
            </span>
          </div>
        );
      },
    },
    {
      key: 'title',
      label: 'Finding & Rule',
      render: (title, row) => (
        <div>
          <div style={{ fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
            {title}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            <span style={{ color: 'var(--color-accent-primary)' }}>{row.id}</span> • {row.ruleId || row.rule_id}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: '180px',
      render: (cat) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {cat}
        </span>
      ),
    },
    {
      key: 'file',
      label: 'Location',
      render: (file, row) => (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>{file}</span>
          <div style={{ color: 'var(--color-text-muted)' }}>{row.lineRange || row.line_range}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: (status) => (
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: status === 'Resolved' ? 'rgba(0, 245, 160, 0.1)' : 'var(--color-surface-elevated)',
            color: status === 'Resolved' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {status}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* 1. Page Header */}
      <PageHeader
        title="Findings Explorer"
        icon={<ShieldAlert size={24} />}
        description="Search, filter, and inspect line-level maintainability findings, complexity hotspots, and structural debt."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Badge variant={currentAnalysis.repository?.isDemo ? 'demo' : 'success'}>
              <Sparkles size={11} />
              <span>{currentAnalysis.repository?.name} {currentAnalysis.repository?.isDemo ? '(DEMO)' : '(REAL)'}</span>
            </Badge>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {allFindings.length} findings recorded
            </span>
          </div>
        }
      />

      {/* 2. Filter & Search Toolbar Card */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <CardBody style={{ padding: 'var(--space-md) var(--space-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {/* Top row: Search and primary controls */}
            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1', minWidth: '260px' }}>
                <Input
                  placeholder="Search findings by ID, title, file, or rule..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  icon={<Search size={15} />}
                />
              </div>

              <div style={{ width: '200px' }}>
                <Select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All Categories' },
                    { value: 'Cyclomatic Complexity', label: 'Complexity' },
                    { value: 'Code Duplication', label: 'Duplication' },
                    { value: 'Architectural Coupling', label: 'Coupling' },
                    { value: 'Error-Handling Consistency', label: 'Error Handling' },
                  ]}
                />
              </div>

              <div style={{ width: '150px' }}>
                <Select
                  value={selectedSeverity}
                  onChange={(e) => {
                    setSelectedSeverity(e.target.value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All Severities' },
                    { value: 'critical', label: 'Critical Attention' },
                    { value: 'high', label: 'High Priority' },
                    { value: 'medium', label: 'Medium Priority' },
                    { value: 'low', label: 'Low Priority' },
                  ]}
                />
              </div>

              <div style={{ width: '140px' }}>
                <Select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'Open', label: 'Open' },
                    { value: 'In Review', label: 'In Review' },
                    { value: 'Resolved', label: 'Resolved' },
                    { value: 'Suppressed', label: 'Suppressed' },
                  ]}
                />
              </div>

              <div style={{ width: '180px' }}>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  options={[
                    { value: 'severity-desc', label: 'Severity: High to Low' },
                    { value: 'severity-asc', label: 'Severity: Low to High' },
                    { value: 'title-asc', label: 'Title (A–Z)' },
                    { value: 'category-asc', label: 'Category (A–Z)' },
                    { value: 'file-asc', label: 'File Path (A–Z)' },
                    { value: 'id-asc', label: 'Finding ID (Asc)' },
                  ]}
                />
              </div>

              <Button
                variant="secondary"
                icon={<RotateCcw size={14} />}
                onClick={handleClearFilters}
                title="Reset all search queries and dropdown filters"
              >
                Clear
              </Button>
            </div>

            {/* Bottom row: Filter stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span style={{ background: 'var(--color-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  Showing <strong>{filteredFindings.length}</strong> of <strong>{allFindings.length}</strong> total findings
                </span>
                {searchTerm && (
                  <span style={{ color: 'var(--color-accent-primary)' }}>
                    Query: "{searchTerm}"
                  </span>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                Select any row to inspect line coordinates and suggested remediation
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 3. Findings Table or Empty Filter State */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          {filteredFindings.length === 0 ? (
            <div style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
              <EmptyState
                icon={<Filter size={32} color="var(--color-text-muted)" />}
                title="No Matching Findings"
                description={
                  searchTerm
                    ? `No findings match "${searchTerm}" with the active category and severity filters.`
                    : 'No findings match the current category, severity, and status filters.'
                }
                action={
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {searchTerm && (
                      <Button variant="secondary" icon={<X size={14} />} onClick={() => setSearchTerm('')}>
                        Clear Search Query
                      </Button>
                    )}
                    <Button variant="primary" icon={<RotateCcw size={14} />} onClick={handleClearFilters}>
                      Reset All Filters
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            <Table
              columns={columns}
              data={paginatedFindings}
              onRowClick={(row) => setActiveFinding(row)}
            />
          )}
        </CardBody>
      </Card>

      {/* 4. Pagination Footer */}
      {filteredFindings.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'var(--space-md)',
            padding: 'var(--space-sm) 0',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            flexWrap: 'wrap',
            gap: 'var(--space-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span>Items per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                padding: '2px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={Math.max(18, allFindings.length)}>All ({allFindings.length})</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <Button
                variant="secondary"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 8px' }}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '4px 8px' }}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Finding Detail Inspection Modal */}
      <FindingDetailModal
        finding={activeFinding}
        onClose={() => setActiveFinding(null)}
        onSelectRelatedFinding={handleSelectRelatedFinding}
      />
    </div>
  );
}

export default FindingsPage;
