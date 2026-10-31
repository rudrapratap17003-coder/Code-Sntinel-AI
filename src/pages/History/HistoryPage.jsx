import React, { useState, useMemo } from 'react';
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
  } = useAnalysis();

  // Search & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('timestamp-desc');

  // Deletion Confirmation Dialog State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

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

  const handleOpenAnalysis = (record) => {
    restoreAnalysis(record);
    navigate(ROUTES.OVERVIEW);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteHistoryRecord(deleteTarget.id);
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
          {row.repository?.modeLabel || 'DEMO ANALYSIS'}
        </Badge>
      ),
    },
    {
      key: 'cmdi',
      label: 'CMDI Score',
      align: 'center',
      width: '110px',
      render: (_, row) => {
        const cmdi = row.summary?.cmdi;
        return (
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            <strong style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-base)' }}>
              {cmdi}
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
        const cat = row.summary?.riskCategory || 'Moderate Risk';
        const variant = cat.toLowerCase().includes('critical')
          ? 'critical'
          : cat.toLowerCase().includes('high')
          ? 'medium'
          : 'info';
        return <Badge variant={variant}>{cat}</Badge>;
      },
    },
    {
      key: 'findingsCount',
      label: 'Findings',
      align: 'center',
      width: '100px',
      render: (_, row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
          {row.findings?.length || row.repository?.findingsCount || 0} issues
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '130px',
      render: (_, row) => {
        const isCurrentActive = currentAnalysis?.id === row.id;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-xs)' }}>
            <Button
              variant={isCurrentActive ? 'secondary' : 'primary'}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAnalysis(row);
              }}
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              {isCurrentActive ? 'Inspect Active' : 'Restore'}
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
        description="Revisit, restore, and compare previous repository technical debt analyses preserved in browser storage."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Badge variant="demo">
              <Sparkles size={11} />
              <span>{historyRecords.length} Saved Runs</span>
            </Badge>
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
                  { value: 'cmdi-desc', label: 'CMDI: Highest Risk First' },
                  { value: 'cmdi-asc', label: 'CMDI: Lowest Risk First' },
                  { value: 'repo-asc', label: 'Repository Name (A-Z)' },
                ]}
              />
            </div>

            {searchTerm && (
              <Button
                variant="secondary"
                icon={<RotateCcw size={14} />}
                onClick={() => setSearchTerm('')}
              >
                Clear
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 3. History Table or Empty State */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          {historyRecords.length === 0 ? (
            <div style={{ padding: 'var(--space-3xl) var(--space-md)' }}>
              <EmptyState
                icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
                title="No Analysis History Found"
                description="Your local analysis history is currently empty. Run an analysis on a repository or reset to the baseline demonstration runs."
                action={
                  <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Button
                      variant="primary"
                      icon={<Sparkles size={16} />}
                      onClick={resetToSeedHistory}
                    >
                      Restore Demo History Runs
                    </Button>
                    <Button
                      to={ROUTES.REPOSITORY}
                      variant="secondary"
                      icon={<Play size={16} />}
                    >
                      Analyze New Repository
                    </Button>
                  </div>
                }
              />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: 'var(--space-2xl) var(--space-md)' }}>
              <EmptyState
                icon={<Search size={32} color="var(--color-text-muted)" />}
                title="No Matching Records"
                description={`No historical analyses match your search "${searchTerm}".`}
                action={
                  <Button variant="secondary" onClick={() => setSearchTerm('')}>
                    Reset Search Filter
                  </Button>
                }
              />
            </div>
          ) : (
            <Table
              columns={columns}
              data={sortedRecords}
              onRowClick={(row) => handleOpenAnalysis(row)}
            />
          )}
        </CardBody>
      </Card>

      {/* Deletion Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Historical Analysis?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete Record"
        cancelLabel="Keep Record"
        isDanger={true}
      >
        <p>
          Are you sure you want to permanently delete the saved demonstration analysis for{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {deleteTarget?.repository?.name}
          </strong>{' '}
          from your browser storage?
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '8px' }}>
          This action only affects your local client storage.
        </p>
      </ConfirmDialog>

      {/* Clear All Confirmation Modal */}
      <ConfirmDialog
        isOpen={showClearAllDialog}
        title="Clear Entire Analysis History?"
        onCancel={() => setShowClearAllDialog(false)}
        onConfirm={handleConfirmClearAll}
        confirmLabel="Clear All Records"
        cancelLabel="Cancel"
        isDanger={true}
      >
        <p>
          Are you sure you want to clear all saved historical analyses from localStorage?
          You can restore the default demonstration entries at any time.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export default HistoryPage;
