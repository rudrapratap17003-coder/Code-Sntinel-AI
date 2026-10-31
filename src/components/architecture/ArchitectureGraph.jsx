import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ModuleNode } from './ModuleNode';
import { Button } from '../ui/Button';
import { RotateCcw, Maximize2 } from 'lucide-react';

const nodeTypes = {
  moduleNode: ModuleNode,
};

/**
 * Interactive React Flow Architecture Dependency Graph.
 *
 * @param {Object} props
 * @param {Array<Object>} props.initialNodes
 * @param {Array<Object>} props.initialEdges
 * @param {Object|null} props.selectedModule
 * @param {Function} props.onSelectModule
 * @param {Function} [props.onResetView]
 */
export function ArchitectureGraph({
  initialNodes = [],
  initialEdges = [],
  selectedModule,
  onSelectModule,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Sync edge styling based on selected node and circular cycle status
  useEffect(() => {
    const styledEdges = initialEdges.map((edge) => {
      const isCircular = edge.data?.isCircular;
      const isLayerViolation = edge.data?.isLayerViolation;
      const isConnected =
        selectedModule &&
        (edge.source === selectedModule.id || edge.target === selectedModule.id);

      let strokeColor = '#26352C'; // default subtle border
      let strokeWidth = 1.5;

      if (isCircular) {
        strokeColor = '#FF5D68'; // Critical red for circular cycles
        strokeWidth = 2.5;
      } else if (isLayerViolation) {
        strokeColor = '#F5B942'; // Warning orange for layer violations
        strokeWidth = 2;
      } else if (isConnected) {
        strokeColor = '#00F5A0'; // Emerald highlight for selected node connections
        strokeWidth = 2.5;
      }

      return {
        ...edge,
        animated: isCircular || isConnected,
        style: {
          stroke: strokeColor,
          strokeWidth,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
      };
    });

    setEdges(styledEdges);
  }, [initialEdges, selectedModule]);

  // Synchronize node selection state
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: selectedModule?.id === node.id,
      }))
    );
  }, [selectedModule, setNodes]);

  const onNodeClick = useCallback(
    (_, node) => {
      onSelectModule(node.id);
    },
    [onSelectModule]
  );

  const onPaneClick = useCallback(() => {
    onSelectModule(null);
  }, [onSelectModule]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }
  }, [reactFlowInstance]);

  const handleReset = useCallback(() => {
    onSelectModule(null);
    if (reactFlowInstance) {
      reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 0.95 }, { duration: 400 });
    }
  }, [reactFlowInstance, onSelectModule]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '580px', background: '#0D120F', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 10,
          display: 'flex',
          gap: 'var(--space-xs)',
          background: 'rgba(17, 23, 19, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
        }}
      >
        <button
          type="button"
          onClick={handleFitView}
          aria-label="Fit graph to view bounds"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-primary)',
            padding: '6px 10px',
            minHeight: '32px',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: 'var(--radius-sm)',
          }}
          title="Fit graph to view bounds"
        >
          <Maximize2 size={13} />
          <span>Fit View</span>
        </button>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset zoom and clear selection"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            padding: '6px 10px',
            minHeight: '32px',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: 'var(--radius-sm)',
          }}
          title="Reset zoom and clear selection"
        >
          <RotateCcw size={13} />
          <span>Reset</span>
        </button>
      </div>

      {/* Floating Legend Pill */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 10,
          background: 'rgba(17, 23, 19, 0.9)',
          backdropFilter: 'blur(4px)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          color: 'var(--color-text-muted)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00F5A0' }} />
          <span>Service</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#55C7E8' }} />
          <span>Core</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F5B942' }} />
          <span>Adapter</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '2px', background: '#FF5D68' }} />
          <span style={{ color: '#FF5D68', fontWeight: 'bold' }}>Circular Dependency</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2.0}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#172019" gap={24} size={1} />
        <Controls
          showInteractive={false}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        />
      </ReactFlow>
    </div>
  );
}

export default ArchitectureGraph;
