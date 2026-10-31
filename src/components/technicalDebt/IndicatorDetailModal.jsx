import React, { useEffect } from 'react';
import { X, ArrowRight, Activity, Layers, Network, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * Detailed Explanation Modal for a Technical Debt Indicator.
 * @param {Object} props
 * @param {Object|null} props.indicator
 * @param {Function} props.onClose
 */
export function IndicatorDetailModal({ indicator, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    if (indicator) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [indicator, onClose]);

  if (!indicator) return null;

  const icons = {
    complexity: <Activity size={20} color="var(--color-severity-critical)" />,
    duplication: <Layers size={20} color="var(--color-severity-medium)" />,
    coupling: <Network size={20} color="var(--color-severity-critical)" />,
    error_handling: <AlertTriangle size={20} color="var(--color-severity-medium)" />,
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="indicator-modal-title"
    >
      <div
        className="modal-dialog"
        style={{ maxWidth: '680px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {icons[indicator.id] || <Activity size={20} />}
            </div>
            <h3 id="indicator-modal-title" className="modal-title">
              {indicator.name}
            </h3>
            <Badge variant={indicator.severity}>{indicator.severity.toUpperCase()}</Badge>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Top Metric Strip */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 'var(--space-sm)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Raw Measurement:</span>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-bold)', marginTop: '2px' }}>
                {indicator.rawMetric || 'Not available'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Normalized Risk:</span>
              <div style={{ color: 'var(--color-severity-critical)', fontWeight: 'var(--font-bold)', marginTop: '2px' }}>
                {indicator.normalizedRisk !== null && indicator.normalizedRisk !== undefined ? `${indicator.normalizedRisk} / 100` : 'Not available'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Weight in CMDI:</span>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-bold)', marginTop: '2px' }}>
                {Math.round((indicator.effectiveWeight ?? indicator.weight ?? 0.25) * 100)}%
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Contribution:</span>
              <div style={{ color: 'var(--color-accent-primary)', fontWeight: 'var(--font-bold)', marginTop: '2px' }}>
                {indicator.normalizedRisk !== null ? `+${indicator.contribution} pts` : 'Not available'}
              </div>
            </div>
          </div>

          {/* 1. What It Means */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              What This Indicator Means
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              {indicator.meaning}
            </p>
          </div>

          {/* 2. Why It Matters */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Why It Matters
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              {indicator.whyItMatters}
            </p>
          </div>

          {/* 3. How It Is Calculated */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-primary)', marginBottom: '4px' }}>
              Calculation & Classification ({indicator.classificationLabel})
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', lineHeight: '1.5', fontFamily: 'var(--font-mono)' }}>
              {indicator.howCalculated}
            </p>
          </div>

          {/* 4. Evidence Available */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Demonstrated Codebase Evidence
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              {indicator.evidence}
            </p>
          </div>

          {/* 5. Recommended Developer Action */}
          <div
            style={{
              backgroundColor: 'rgba(0, 245, 160, 0.05)',
              border: '1px solid rgba(0, 245, 160, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-primary)', marginBottom: '4px' }}>
              What The Developer Should Do Next
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
              {indicator.developerAction}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            to={indicator.targetRoute}
            variant="primary"
            iconEnd={<ArrowRight size={14} />}
            onClick={onClose}
          >
            Inspect Related Findings
          </Button>
        </div>
      </div>
    </div>
  );
}

export default IndicatorDetailModal;
