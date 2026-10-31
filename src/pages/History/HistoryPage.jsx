import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Search,
  RotateCcw,
  Trash2,
  Play,
  FolderPlus,
  Sparkles,
  GitBranch,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
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
  ConfirmDialog,
  ErrorMessage,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ROUTES } from '../../utils/constants';

export function HistoryPage() {
  useDocumentTitle('Analysis History');
  const navigate = useNavigate();

  const {
    currentAnalysis,
    historyRecords = [],
    corruptedCount = 0,
    restoreAnalysis,
    deleteHistoryRecord,
    clearAllHistory,
    resetToSeedHistory,
    syncBackendHistory,
    isSyncingHistory,
    syncError,
  } = useAnalysis();

  // Search & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('timestamp-desc');
  const [openingId, setOpeningId] = useState(null);
  const [deletionError, setDeletionError] = useState(null);

  // Deletion Confirmation Dialog State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page when filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // 1. Filter by Search Query
  const filteredRecords = useMemo(() => {
    return historyRecords.filter((record) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const name = (record.repository?.name || '').toLowerCase();
      const url = (record.repository?.url || '').toLowerCase();
      const id = (record.id || '').toLowerCase();
      return name.includes(q) || url.includes(q) || id.includes(q);
    });
  }, [historyRecords, searchTerm]);

  // 2. Sort Records
  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    list.sort((a, b) => {
      if (sortBy === 'timestamp-desc') {
        const timeA = new Date(a.timestamp || a.repository?.lastAnalyzed || 0).getTime();
        const timeB = new Date(b.timestamp || b.repository?.lastAnalyzed || 0).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'timestamp-asc') {
        const timeA = new Date(a.timestamp || a.repository?.lastAnalyzed || 0).getTime();
        const timeB = new Date(b.timestamp || b.repository?.lastAnalyzed || 0).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'cmdi-desc') {
        return (b.summary?.cmdi || 0) - (a.summary?.cmdi || 0);
      }
      if (sortBy === 'cmdi-asc') {
        return (a.summary?.cmdi || 0) - (b.summary?.cmdi || 0);
      }
      if (sortBy === 'repo-asc') {
        return (a.repository?.name || '').localeCompare(b.repository?.name || '');
      }
      return 0;
    });
    return list;
  }, [filteredRecords, sortBy]);

  // 3. Paginate Records
  const totalItems = sortedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleOpenAnalysis = async (record) => {
    setOpeningId(record.id);
    try {
      await restoreAnalysis(record);
      navigate(ROUTES.OVERVIEW);
    } finally {
      setOpeningId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      setDeletionError(null);
      const res = await deleteHistoryRecord(deleteTarget.id);
      if (res && res.error) {
        setDeletionError(res.error);
      }
      setDeleteTarget(null);
    }
  };

  const handleConfirmClearAll = () => {
    clearAllHistory();
    setShowClearAllDialog(false);
  };

  // History Table Columns
  const columns = [
    {
      key: 'repository',
      label: 'Repository & Branch',
      width: '28%',
      render: (_, row) => {
        const isCurrentActive = currentAnalysis?.id === row.id;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitBranch size={13} color="var(--color-accent-primary)" />
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {row.repository?.name}
              </strong>
              {isCurrentActive && (
                <span
                  style={{
                    backgroundColor: 'rgba(0, 245, 160, 0.15)',
                    border: '1px solid var(--color-accent-primary)',
                    color: 'var(--color-accent-primary)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '1px 5px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold',
                  }}
                >
                  ACTIVE
                </span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {row.repository?.url} • ({row.repository?.branch || 'main'})
            </div>
          </div>
        );
      },
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      width: '150px',
      render: (_, row) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          {row.displayTimestamp || row.repository?.displayTimestamp || 'Timestamp unavailable'}
        </span>
      ),
    },
    {
      key: 'mode',
      label: 'Mode',
      width: '130px',
      render: (_, row) => (
        <Badge variant={row.repository?.isDemo ? 'demo' : 'success'}>
          {row.repository?.modeLabel || (row.repository?.isDemo ? 'DEMO ANALYSIS' : 'REAL ANALYSIS')}
        </Badge>
      ),
    },
    {
      key: 'cmdi',
      label: 'CMDI Score',
      align: 'center',
      width: '120px',
      render: (_, row) => {
        const isAvailable = row.summary?.scoreAvailable !== false && row.summary?.score_available !== false && row.summary?.cmdi !== null && row.summary?.riskCategory !== 'Not Available' && row.summary?.risk_category !== 'Not Available';
        const cmdi = isAvailable && typeof row.summary?.cmdi === 'number' ? row.summary.cmdi : null;

        if (cmdi === null) {
          return (
            <Badge variant="default" style={{ fontSize: '10px' }}>
              Not Available
            </Badge>
          );
        }

        return (
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            <strong style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-base)' }}>
              {cmdi.toFixed(1)}
            </strong>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}> / 100</span>
          </div>
        );
      },
    },
    {
      key: 'riskCategory',
      label: 'Risk Tier',
      align: 'center',
      width: '130px',
      render: (_, row) => {
        const cat = row.summary?.riskCategory || row.summary?.risk_category || 'Low Risk';
        let variant = 'info';
        if (cat === 'Not Available') variant = 'default';
        else if (cat.toLowerCase().includes('critical')) variant = 'critical';
        else if (cat.toLowerCase().includes('high')) variant = 'medium';
        else if (cat.toLowerCase().includes('moderate')) variant = 'info';
        else if (cat.toLowerCase().includes('low')) variant = 'success';
        return <Badge variant={variant}>{cat}</Badge>;
      },
    },
    {
      key: 'findingsCount',
      label: 'Issues',
      align: 'center',
      width: '90px',
      render: (_, row) => {
        const count = row.repository?.findingsCount ?? row.findings?.length ?? 0;
        return (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
            {count}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '140px',
      render: (_, row) => {
        const isOpening = openingId === row.id;
        return (
          <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button
              variant="secondary"
              onClick={() => handleOpenAnalysis(row)}
              disabled={isOpening}
              style={{ fontSize: '11px', padding: '3px 8px' }}
              icon={isOpening ? <RefreshCw size={11} className="spinning-icon" /> : <Play size={11} />}
            >
              {isOpening ? 'Loading...' : 'Open'}
            </Button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 6px',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Delete historical analysis entry"
              aria-label={`Delete record for ${row.repository?.name}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* 1. Page Header */}
      <PageHeader
        title="Analysis History"
        icon={<History size={24} />}
        description="Revisit, restore, and compare previous repository technical debt analyses preserved in browser storage and backend database."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Badge variant="demo">
              <Sparkles size={11} />
              <span>{historyRecords.length} Saved Runs</span>
            </Badge>
            <Button
              variant="secondary"
              icon={<RefreshCw size={12} className={isSyncingHistory ? 'spinning-icon' : ''} />}
              onClick={syncBackendHistory}
              disabled={isSyncingHistory}
              style={{ fontSize: 'var(--text-xs)' }}
              title="Sync historical analysis records from SQLite database"
            >
              {isSyncingHistory ? 'Syncing...' : 'Sync Database'}
            </Button>
            {historyRecords.length > 0 && (
              <Button
                variant="secondary"
                icon={<Trash2 size={13} />}
                onClick={() => setShowClearAllDialog(true)}
                style={{ fontSize: 'var(--text-xs)' }}
              >
                Clear History
              </Button>
            )}
          </div>
        }
      />

      {/* Sync or Deletion Error Notices */}
      {syncError && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <ErrorMessage severity="medium" title="Database Sync Notice">
            {syncError} (Local storage history records remain fully accessible).
          </ErrorMessage>
        </div>
      )}

      {deletionError && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <ErrorMessage severity="medium" title="Removal Notice">
            {deletionError}
          </ErrorMessage>
        </div>
      )}

      {/* Corrupted records recovery notification if any */}
      {corruptedCount > 0 && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <ErrorMessage severity="medium" title="Storage Notice">
            {corruptedCount} outdated or corrupted storage record(s) were safely quarantined and ignored without interrupting the application.
          </ErrorMessage>
        </div>
      )}

      {/* 2. Filter & Search Toolbar */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <CardBody style={{ padding: 'var(--space-md) var(--space-lg)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1', minWidth: '260px' }}>
              <Input
                placeholder="Search history by repository name or URL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search size={15} />}
              />
            </div>

            <div style={{ width: '220px' }}>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: 'timestamp-desc', label: 'Latest Scan First' },
                  { value: 'timestamp-asc', label: 'Oldest Scan First' },
                  { value: 'cmdi-desc', label: 'Highest Debt (CMDI)' },
                  { value: 'cmdi-asc', label: 'Lowest Debt (CMDI)' },
                  { value: 'repo-asc', label: 'Repository Name (A-Z)' },
                ]}
              />
            </div>

            {searchTerm && (
              <Button
                variant="secondary"
                onClick={() => setSearchTerm('')}
                style={{ fontSize: 'var(--text-xs)' }}
              >
                Clear Search
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 3. History Table or Empty State */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          {sortedRecords.length === 0 ? (
            <div style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
              <EmptyState
                icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
                title={searchTerm ? 'No Matching Records' : 'No Analysis History'}
                description={
                  searchTerm
                    ? `No historical analyses match your search "${searchTerm}".`
                    : 'Analyze a repository in Repository Analysis to build maintainability history.'
                }
                action={
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {searchTerm ? (
                      <Button variant="secondary" onClick={() => setSearchTerm('')}>
                        Clear Search
                      </Button>
                    ) : (
                      <>
                        <Button
                          to={ROUTES.REPOSITORY}
                          variant="primary"
                          icon={<Play size={15} />}
                        >
                          Analyze Repository
                        </Button>
                        <Button
                          variant="secondary"
                          icon={<RotateCcw size={14} />}
                          onClick={resetToSeedHistory}
                        >
                          Load Demonstration Seeds
                        </Button>
                      </>
                    )}
                  </div>
                }
              />
            </div>
          ) : (
            <Table
              columns={columns}
              data={paginatedRecords}
              onRowClick={(row) => handleOpenAnalysis(row)}
            />
          )}
        </CardBody>
      </Card>

      {/* 4. Pagination Footer */}
      {sortedRecords.length > 0 && (
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
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>
              Showing {sortedRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} records
            </span>
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

      {/* 4. Single Record Deletion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Analysis Record"
        confirmLabel="Delete Record"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <p style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', lineHeight: '1.5' }}>
          Are you sure you want to delete the analysis record for <strong>"{deleteTarget?.repository?.name}"</strong> ({deleteTarget?.displayTimestamp})? This action removes it from browser storage and backend database.
        </p>
      </ConfirmDialog>

      {/* 5. Clear All History Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearAllDialog}
        title="Clear Entire Analysis History"
        confirmLabel="Clear All History"
        isDanger={true}
        onConfirm={handleConfirmClearAll}
        onCancel={() => setShowClearAllDialog(false)}
      >
        <p style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', lineHeight: '1.5' }}>
          Are you sure you want to clear your local analysis history? This action cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export default HistoryPage;
