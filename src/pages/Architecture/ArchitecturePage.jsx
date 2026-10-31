import React, { useState, useMemo } from 'react';
import {
  Network,
  GitGraph,
  AlertTriangle,
  Sparkles,
  Info,
  RotateCcw,
  Table as TableIcon,
  FolderPlus,
  Play,
  Share2,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  MetricCard,
  Badge,
  Button,
  Select,
  EmptyState,
} from '../../ui';
import { useAnalysis } from '../../context/AnalysisContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { DEMO_ARCHITECTURE } from '../../data/demoArchitecture';
import { ArchitectureGraph } from '../../components/architecture/ArchitectureGraph';
import { ModuleDetailsPanel } from '../../components/architecture/ModuleDetailsPanel';
import { ModuleListView } from '../../components/architecture/ModuleListView';
import { ROUTES } from '../../utils/constants';

export function ArchitecturePage() {
  useDocumentTitle('Architecture Explorer');

  const {
    currentAnalysis,
    loadDemoAnalysis,
  } = useAnalysis();

  const isDemo = Boolean(currentAnalysis?.repository?.isDemo);
  const architectureData = isDemo
    ? (currentAnalysis?.architecture || DEMO_ARCHITECTURE)
    : (currentAnalysis?.architecture || {
        metrics: {
          totalModules: 0,
          totalDependencies: 0,
          circularCyclesCount: 0,
          maxAfferentCoupling: { module: 'None', inDegree: 0 },
          systemModularityScore: '100%',
        },
        nodes: [],
        edges: [],
      });

  const { metrics = {}, nodes = [], edges = [] } = architectureData;

  const [selectedModuleId, setSelectedModuleId] = useState(() => nodes[0]?.id || (isDemo ? 'mod-pipeline' : ''));
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'list'

  // If active selection is invalid for current nodes, reset to first node
  React.useEffect(() => {
    if (nodes.length > 0 && (!selectedModuleId || !nodes.some((n) => n.id === selectedModuleId))) {
      setSelectedModuleId(nodes[0].id);
    }
  }, [nodes, selectedModuleId]);

  // If no analysis is loaded, render empty state
  if (!currentAnalysis) {
    return (
      <div>
        <PageHeader
          title="Architecture Explorer"
          icon={<Network size={24} />}
          description="Analyze module dependencies, detect architectural cycles, and evaluate structural blast radius."
        />

        <div style={{ maxWidth: '720px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<FolderPlus size={36} color="var(--color-accent-primary)" />}
            title="No Codebase Architecture Loaded"
            description="To visualize module coupling and circular dependency cycles, analyze a repository or initialize the demonstration architecture."
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

  // If real analysis has 0 modules or dependencies
  if (nodes.length === 0) {
    return (
      <div>
        <PageHeader
          title="Architecture Explorer"
          icon={<Network size={24} />}
          description="Analyze module dependencies, detect architectural cycles, and evaluate structural blast radius."
          actions={
            <Badge variant="success">
              <Cpu size={11} />
              <span>{currentAnalysis.repository?.name || 'Repository'} (REAL AST)</span>
            </Badge>
          }
        />

        <div style={{ maxWidth: '720px', margin: 'var(--space-2xl) auto' }}>
          <EmptyState
            icon={<Network size={36} color="var(--color-accent-primary)" />}
            title="No Architectural Dependencies Detected"
            description="The analyzed repository was scanned successfully, but no inter-module import relationships or internal dependency edges were detected among the discovered files."
            action={
              <Button
                to={ROUTES.REPOSITORY}
                variant="secondary"
                icon={<Play size={16} />}
              >
                Analyze Another Repository
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const selectedModule = useMemo(() => {
    return nodes.find((n) => n.id === selectedModuleId) || null;
  }, [nodes, selectedModuleId]);

  const moduleSelectOptions = useMemo(() => [
    { value: '', label: 'Select a module to inspect...' },
    ...nodes.map((n) => ({
      value: n.id,
      label: `${n.data?.label || n.id} (${n.data?.category || 'Module'})`,
    })),
  ], [nodes]);

  const handleSelectModule = (id) => {
    setSelectedModuleId(id || null);
  };

  const handleReset = () => {
    setSelectedModuleId(nodes[0]?.id || null);
  };

  const maxAfferentInDegree = typeof metrics.maxAfferentCoupling === 'object'
    ? (metrics.maxAfferentCoupling?.inDegree ?? 0)
    : (metrics.maxAfferentCoupling ?? metrics.max_afferent_coupling ?? 0);

  const maxAfferentModuleName = typeof metrics.maxAfferentCoupling === 'object'
    ? (metrics.maxAfferentCoupling?.module || 'None')
    : 'Primary Module';

  const circularCycles = metrics.circularCyclesCount ?? metrics.circular_cycles_count ?? 0;

  return (
    <div>
      {/* 1. Page Header */}
      <PageHeader
        title="Architecture Explorer"
        icon={<Network size={24} />}
        description="Analyze module dependencies, detect architectural cycles, and evaluate structural blast radius."
        actions={
          <Badge variant={isDemo ? 'demo' : 'success'}>
            {isDemo ? (
              <>
                <Sparkles size={11} />
                <span>{currentAnalysis.repository.name} (DEMO)</span>
              </>
            ) : (
              <>
                <Cpu size={11} />
                <span>{currentAnalysis.repository.name} (REAL AST)</span>
              </>
            )}
          </Badge>
        }
      />

      {/* 2. Architecture Notice (Adapts between Real Engine and Demo Mode) */}
      {isDemo ? (
        <div
          style={{
            backgroundColor: 'rgba(85, 199, 232, 0.08)',
            border: '1px solid rgba(85, 199, 232, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-lg)',
            marginBottom: 'var(--space-xl)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-md)',
          }}
        >
          <Info size={18} color="var(--color-severity-info)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: 'var(--text-xs)', lineHeight: '1.5', color: 'var(--color-text-primary)' }}>
            <strong style={{ color: 'var(--color-severity-info)' }}>
              DEMO ARCHITECTURE — NOT EXTRACTED FROM THE SUBMITTED REPOSITORY.
            </strong>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
              The module graph below illustrates structural coupling and cycle detection on a synthetic reference architecture.
              To extract live AST dependency graphs, run real analysis in Repository Analysis.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(0, 245, 160, 0.08)',
            border: '1px solid rgba(0, 245, 160, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-lg)',
            marginBottom: 'var(--space-xl)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-md)',
          }}
        >
          <CheckCircle2 size={18} color="var(--color-accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: 'var(--text-xs)', lineHeight: '1.5', color: 'var(--color-text-primary)' }}>
            <strong style={{ color: 'var(--color-accent-primary)' }}>
              REAL AST DEPENDENCY GRAPH — EXTRACTED FROM PYTHON IMPORT STATEMENTS
            </strong>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Nodes represent discovered Python modules and edges reflect compile-time internal imports. Circular dependency cycles are identified via Tarjan's Strongly Connected Components (SCC) algorithm.
            </p>
          </div>
        </div>
      )}

      {/* 3. Summary Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <MetricCard
          label="Total Modules"
          value={metrics.totalModules ?? metrics.total_modules ?? nodes.length}
          subvalue="nodes"
          badgeText={isDemo ? "Reference" : "Discovered"}
          badgeVariant={isDemo ? "demo" : "info"}
          description="Source files mapped in module dependency tree."
        />
        <MetricCard
          label="Dependency Edges"
          value={metrics.totalDependencies ?? metrics.total_dependencies ?? edges.length}
          subvalue="imports"
          badgeText={isDemo ? "Static" : "AST"}
          badgeVariant="info"
          description="Directed static import references between modules."
        />
        <MetricCard
          label="Circular Dependencies"
          value={circularCycles}
          subvalue="cycle"
          badgeText={circularCycles > 0 ? "Critical Defect" : "Clean"}
          badgeVariant={circularCycles > 0 ? "critical" : "success"}
          description={circularCycles > 0 ? "Circular import loops require remediation." : "No circular import cycles detected."}
          icon={circularCycles > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
        />
        <MetricCard
          label="Max Afferent Coupling"
          value={maxAfferentInDegree}
          subvalue="callers"
          badgeText="Coupling"
          badgeVariant={maxAfferentInDegree >= 3 ? "medium" : "success"}
          description={`Highest in-degree: ${maxAfferentModuleName}`}
          icon={<Share2 size={16} />}
        />
        <MetricCard
          label="Modularity Score"
          value={metrics.systemModularityScore ?? metrics.system_modularity_score ?? '100%'}
          badgeText="System"
          badgeVariant="success"
          description="Module boundary cohesion vs coupling ratio."
        />
      </div>

      {/* 4. Toolbar: Module Selector, View Toggle, and Reset */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <CardBody style={{ padding: 'var(--space-md) var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flex: 1, minWidth: '280px' }}>
              <div style={{ width: '280px' }}>
                <Select
                  value={selectedModuleId || ''}
                  onChange={(e) => handleSelectModule(e.target.value)}
                  options={moduleSelectOptions}
                />
              </div>

              {selectedModuleId && (
                <Button
                  variant="secondary"
                  onClick={handleReset}
                  icon={<RotateCcw size={13} />}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  Clear Selection
                </Button>
              )}
            </div>

            {/* View Mode Toggle: Interactive Graph vs Accessible Table */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface-elevated)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <button
                onClick={() => setViewMode('graph')}
                style={{
                  background: viewMode === 'graph' ? 'var(--color-surface)' : 'transparent',
                  color: viewMode === 'graph' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                  border: viewMode === 'graph' ? '1px solid var(--color-border)' : 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'graph' ? 'bold' : 'normal',
                }}
              >
                <GitGraph size={14} />
                <span>Interactive Graph</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                  border: viewMode === 'list' ? '1px solid var(--color-border)' : 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'list' ? 'bold' : 'normal',
                }}
              >
                <TableIcon size={14} />
                <span>Accessible Table List</span>
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 5. Main Canvas Grid: Graph/List on Left + Details Panel on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)',
          alignItems: 'stretch',
        }}
      >
        <div>
          {viewMode === 'graph' ? (
            <ArchitectureGraph
              initialNodes={nodes}
              initialEdges={edges}
              selectedModule={selectedModule}
              onSelectModule={handleSelectModule}
            />
          ) : (
            <ModuleListView
              modules={nodes}
              selectedModuleId={selectedModuleId}
              onSelectModule={handleSelectModule}
            />
          )}
        </div>

        <div>
          <ModuleDetailsPanel
            selectedModule={selectedModule}
            allModules={nodes}
            allEdges={edges}
            onSelectModule={handleSelectModule}
          />
        </div>
      </div>

      {/* 6. Coupling Explanation & Real Analysis Contract */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
        <Card elevated>
          <CardHeader
            title="Understanding Coupling & Graph Boundaries"
            subtitle="What static dependency graphs demonstrate and what they omit"
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', fontSize: 'var(--text-xs)' }}>
              <p style={{ color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
                <strong>What the graph represents:</strong> Static compile-time import relations between Python modules. Edges denote that module A requires module B to execute.
              </p>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                <strong>What the graph does NOT show:</strong> Runtime call frequency, network latency, or memory allocation. A highly connected module (like a utility logger) is not necessarily defective if it is stable and changes rarely.
              </p>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-xs)', color: 'var(--color-severity-critical)' }}>
                <strong>Circular Dependencies:</strong> Unlike high in-degree coupling, circular import loops are structural defects that hinder independent packaging, trigger garbage collection overhead, and cause fragile import ordering.
              </div>
            </div>
          </CardBody>
        </Card>

        <Card elevated>
          <CardHeader
            title="Real Analysis Contract (Phase 7 Backend)"
            subtitle="How dependency extraction will operate with live repositories"
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <div style={{ color: 'var(--color-accent-primary)' }}>•</div>
                <div style={{ color: 'var(--color-text-primary)' }}>
                  <strong>AST Import Visitor:</strong> Python AST parses inspect <code>import x</code> and <code>from x import y</code> nodes, resolving relative paths against the project root.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <div style={{ color: 'var(--color-accent-primary)' }}>•</div>
                <div style={{ color: 'var(--color-text-primary)' }}>
                  <strong>Tarjan’s Cycle Algorithm:</strong> Evaluates the directed import graph for strongly connected components (SCCs) to detect cycles of any depth ($N \ge 2$).
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <div style={{ color: 'var(--color-accent-primary)' }}>•</div>
                <div style={{ color: 'var(--color-text-muted)' }}>
                  <strong>Zero Synthetic Guesswork:</strong> When real backend analysis is attached, dependencies are populated strictly from real source code, never inferred from repository names.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default ArchitecturePage;
