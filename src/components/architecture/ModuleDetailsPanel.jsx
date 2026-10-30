import React from 'react';
import {
  Layers,
  ArrowRight,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, Button } from '../../ui';
import { ROUTES } from '../../utils/constants';

/**
 * Module Details Panel for Architecture Explorer.
 * @param {Object} props
 * @param {Object|null} props.selectedModule
 * @param {Array<Object>} props.allModules
 * @param {Array<Object>} props.allEdges
 * @param {Function} props.onSelectModule
 */
export function ModuleDetailsPanel({
  selectedModule,
  allModules = [],
  allEdges = [],
  onSelectModule,
}) {
  if (!selectedModule) {
    return (
      <Card style={{ height: '100%' }}>
        <CardHeader
          title="Module Coupling Profile"
          subtitle="Select a node in the graph or dropdown"
        />
        <CardBody>
          <div
            style={{
              padding: 'var(--space-xl) var(--space-md)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-sm)',
            }}
          >
            <Layers size={32} color="var(--color-border)" />
            <p>
              Click any node in the dependency graph or choose from the module selector to analyze its structural coupling, blast radius, and incoming dependents.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const data = selectedModule.data;

  // Compute incoming callers and outgoing targets from active edges
  const incomingEdges = allEdges.filter((e) => e.target === selectedModule.id);
  const outgoingEdges = allEdges.filter((e) => e.source === selectedModule.id);

  const incomingModules = incomingEdges.map((e) =>
    allModules.find((m) => m.id === e.source)
  ).filter(Boolean);

  const outgoingModules = outgoingEdges.map((e) =>
    allModules.find((m) => m.id === e.target)
  ).filter(Boolean);

  return (
    <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={data.label}
        subtitle={data.role}
        actions={
          <Badge variant={data.inCircularCycle ? 'critical' : 'default'}>
            {data.category}
          </Badge>
        }
      />
      <CardBody style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {/* Full File Path */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-xs) var(--space-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-text-primary)',
            wordBreak: 'break-all',
          }}
        >
          {data.fullPath}
        </div>

        {/* Circular Dependency Warning */}
        {data.inCircularCycle && (
          <div
            style={{
              backgroundColor: 'rgba(255, 93, 104, 0.1)',
              border: '1px solid rgba(255, 93, 104, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm) var(--space-md)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-xs)',
            }}
          >
            <AlertTriangle size={15} color="var(--color-severity-critical)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--color-severity-critical)' }}>Circular Dependency Cycle:</strong>
              <p style={{ color: 'var(--color-text-primary)', marginTop: '2px' }}>
                This module participates in a mutual import loop with{' '}
                <button
                  onClick={() => onSelectModule(data.cyclePartnerId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-accent-primary)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {data.cyclePartnerId}
                </button>
                .
              </p>
            </div>
          </div>
        )}

        {/* Coupling Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-xs)', textAlign: 'center' }}>
          <div style={{ background: 'var(--color-surface-elevated)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Afferent (Ca)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 'bold', color: data.afferentCoupling >= 4 ? 'var(--color-severity-medium)' : 'var(--color-text-primary)' }}>
              {data.afferentCoupling}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Callers</div>
          </div>

          <div style={{ background: 'var(--color-surface-elevated)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Efferent (Ce)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
              {data.efferentCoupling}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Targets</div>
          </div>

          <div style={{ background: 'var(--color-surface-elevated)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Instability (I)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 'bold', color: 'var(--color-accent-primary)' }}>
              {data.instability}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Ce/(Ca+Ce)</div>
          </div>
        </div>

        {/* Incoming Dependents (Blast Radius) */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Incoming Callers ({incomingModules.length}) — Blast Radius
          </div>
          {incomingModules.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Zero incoming dependencies. Safe to refactor with minimal external ripple.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {incomingModules.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => onSelectModule(inc.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{inc.data.label}</span>
                  <ArrowDownRight size={12} color="var(--color-text-muted)" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Outgoing Dependencies */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Outgoing Dependencies ({outgoingModules.length})
          </div>
          {outgoingModules.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Leaf node. Does not import any project modules.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {outgoingModules.map((out) => (
                <button
                  key={out.id}
                  onClick={() => onSelectModule(out.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{out.data.label}</span>
                  <ArrowUpRight size={12} color="var(--color-text-muted)" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Action */}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-sm)' }}>
          <Button
            to={ROUTES.FINDINGS}
            variant="secondary"
            iconEnd={<ArrowRight size={13} />}
            style={{ width: '100%', fontSize: 'var(--text-xs)' }}
          >
            Review Module Findings
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default ModuleDetailsPanel;
