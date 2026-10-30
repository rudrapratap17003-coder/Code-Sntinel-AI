import React from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Reusable Alert / Error Banner.
 * @param {Object} props
 * @param {'critical'|'medium'|'info'} [props.severity='critical']
 * @param {string} [props.title]
 * @param {React.ReactNode} props.children
 * @param {Function} [props.onDismiss]
 * @param {string} [props.className]
 */
export function ErrorMessage({
  severity = 'critical',
  title,
  children,
  onDismiss,
  className = '',
  ...props
}) {
  const icons = {
    critical: <AlertCircle size={18} />,
    medium: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className={`alert-banner alert-${severity} ${className}`.trim()} role="alert" {...props}>
      <span style={{ flexShrink: 0, marginTop: '2px' }}>{icons[severity] || icons.critical}</span>
      <div className="alert-banner-content">
        {title && <div className="alert-banner-title">{title}</div>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          aria-label="Dismiss alert"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
