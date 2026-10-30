import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, HelpCircle } from 'lucide-react';
import { Badge } from './Badge';

/**
 * Metric Card for displaying high-density quantitative debt insights.
 * @param {Object} props
 * @param {string} props.label
 * @param {string|number} props.value
 * @param {string} [props.subvalue]
 * @param {number|string} [props.delta]
 * @param {'positive'|'negative'|'neutral'} [props.trend] - positive=green, negative=red
 * @param {string} [props.badgeText]
 * @param {'demo'|'critical'|'medium'|'success'|'info'} [props.badgeVariant]
 * @param {string} [props.description]
 * @param {string} [props.tooltip]
 * @param {React.ReactNode} [props.icon]
 */
export function MetricCard({
  label,
  value,
  subvalue,
  delta,
  trend = 'neutral',
  badgeText,
  badgeVariant = 'default',
  description,
  tooltip,
  icon,
  className = '',
  ...props
}) {
  const trendIcons = {
    positive: <ArrowDownRight size={14} />, // Often in debt, downward delta is positive improvement!
    negative: <ArrowUpRight size={14} />,
    neutral: <Minus size={14} />,
  };

  return (
    <div className={`metric-card ${className}`.trim()} {...props}>
      <div className="metric-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="metric-label">{label}</span>
          {tooltip && (
            <span title={tooltip} style={{ color: 'var(--color-text-muted)', cursor: 'help', display: 'inline-flex' }}>
              <HelpCircle size={12} />
            </span>
          )}
        </div>
        {badgeText && <Badge variant={badgeVariant}>{badgeText}</Badge>}
        {icon && <span style={{ color: 'var(--color-text-muted)' }}>{icon}</span>}
      </div>

      <div className="metric-value-container">
        <span className="metric-value">{value}</span>
        {subvalue && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {subvalue}
          </span>
        )}
        {delta !== undefined && (
          <span className={`metric-trend trend-${trend}`}>
            {trendIcons[trend]}
            <span>{delta}</span>
          </span>
        )}
      </div>

      {description && <p className="metric-description">{description}</p>}
    </div>
  );
}

export default MetricCard;
