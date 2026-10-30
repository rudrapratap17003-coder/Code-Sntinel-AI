import React from 'react';
import { Table, Badge, Button } from '../../ui';

/**
 * Accessible Text-Based Module List view as an alternative to React Flow graph.
 * @param {Object} props
 * @param {Array<Object>} props.modules
 * @param {string|null} props.selectedModuleId
 * @param {Function} props.onSelectModule
 */
export function ModuleListView({ modules = [], selectedModuleId, onSelectModule }) {
  const columns = [
    {
      key: 'label',
      label: 'Module Identifier',
      render: (_, row) => (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            {row.data.label}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {row.data.fullPath}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (_, row) => <Badge variant="default">{row.data.category}</Badge>,
    },
    {
      key: 'afferentCoupling',
      label: 'Callers (Ca)',
      align: 'center',
      render: (_, row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: row.data.afferentCoupling >= 4 ? 'bold' : 'normal', color: row.data.afferentCoupling >= 4 ? 'var(--color-severity-medium)' : 'inherit' }}>
          {row.data.afferentCoupling}
        </span>
      ),
    },
    {
      key: 'efferentCoupling',
      label: 'Dependencies (Ce)',
      align: 'center',
      render: (_, row) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>{row.data.efferentCoupling}</span>
      ),
    },
    {
      key: 'instability',
      label: 'Instability (I)',
      align: 'center',
      render: (_, row) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent-primary)' }}>
          {row.data.instability}
        </span>
      ),
    },
    {
      key: 'inCircularCycle',
      label: 'Circular Cycle',
      align: 'center',
      render: (_, row) =>
        row.data.inCircularCycle ? (
          <Badge variant="critical">CYCLE DETECTED</Badge>
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>None</span>
        ),
    },
    {
      key: 'action',
      label: 'Inspect',
      align: 'right',
      render: (_, row) => (
        <Button
          variant={selectedModuleId === row.id ? 'primary' : 'secondary'}
          onClick={() => onSelectModule(row.id)}
          style={{ fontSize: '11px', padding: '3px 8px' }}
        >
          {selectedModuleId === row.id ? 'Active' : 'Inspect'}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <Table
        columns={columns}
        data={modules}
        onRowClick={(row) => onSelectModule(row.id)}
      />
    </div>
  );
}

export default ModuleListView;
