import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Flame, AlertTriangle, Layers, Database, Cpu, HardDrive } from 'lucide-react';

const CATEGORY_COLORS = {
  Service: '#00F5A0',
  Core: '#55C7E8',
  Adapter: '#F5B942',
  Worker: '#A78BFA',
  Storage: '#9BAAA1',
};

const CATEGORY_ICONS = {
  Service: <Cpu size={12} />,
  Core: <Layers size={12} />,
  Adapter: <AlertTriangle size={12} />,
  Worker: <HardDrive size={12} />,
  Storage: <Database size={12} />,
};

export const ModuleNode = memo(({ data, selected }) => {
  const accentColor = CATEGORY_COLORS[data.category] || '#9BAAA1';

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: selected
          ? '2px solid var(--color-accent-primary)'
          : data.inCircularCycle
          ? '2px solid var(--color-severity-critical)'
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        width: '230px',
        boxShadow: selected
          ? '0 0 16px rgba(0, 245, 160, 0.25)'
          : data.inCircularCycle
          ? '0 0 12px rgba(255, 93, 104, 0.25)'
          : 'var(--shadow-sm)',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
        cursor: 'pointer',
      }}
    >
      {/* Top handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'var(--color-border)', width: '8px', height: '8px' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: 'var(--color-border)', width: '8px', height: '8px' }}
      />

      {/* Header Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            color: accentColor,
            fontWeight: 'bold',
          }}
        >
          {CATEGORY_ICONS[data.category]}
          <span>{data.category}</span>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {data.inCircularCycle && (
            <span
              style={{
                background: 'rgba(255, 93, 104, 0.15)',
                color: 'var(--color-severity-critical)',
                borderRadius: 'var(--radius-xs)',
                padding: '1px 4px',
                fontSize: '9px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono)',
              }}
              title="Circular Dependency Detected"
            >
              CYCLE
            </span>
          )}
          {data.isHotspot && (
            <span
              style={{
                color: 'var(--color-severity-critical)',
                display: 'inline-flex',
              }}
              title="Maintainability Hotspot"
            >
              <Flame size={13} />
            </span>
          )}
        </div>
      </div>

      {/* Module Title / Path */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '2px',
        }}
        title={data.fullPath}
      >
        {data.label}
      </div>

      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
        {data.role}
      </div>

      {/* Coupling Stats Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '6px',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span title={`Afferent Coupling (Ca): ${data.afferentCoupling} modules depend on this`}>
          In: <strong style={{ color: data.afferentCoupling >= 4 ? 'var(--color-severity-medium)' : 'var(--color-text-primary)' }}>{data.afferentCoupling}</strong>
        </span>
        <span title={`Efferent Coupling (Ce): Depends on ${data.efferentCoupling} external modules`}>
          Out: <strong style={{ color: 'var(--color-text-primary)' }}>{data.efferentCoupling}</strong>
        </span>
        <span title={`Instability I = Ce / (Ca + Ce): ${data.instability}`}>
          Instability: <strong style={{ color: 'var(--color-accent-primary)' }}>{data.instability}</strong>
        </span>
      </div>

      {/* Bottom handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'var(--color-accent-primary)', width: '8px', height: '8px' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: 'var(--color-accent-primary)', width: '8px', height: '8px' }}
      />
    </div>
  );
});

export default ModuleNode;
