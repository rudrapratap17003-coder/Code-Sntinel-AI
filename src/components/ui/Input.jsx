import React from 'react';

/**
 * Reusable Form Input component.
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.className]
 */
export function Input({
  label,
  hint,
  error,
  icon,
  id,
  className = '',
  disabled = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)', display: 'flex' }}>
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className="form-input"
          disabled={disabled}
          style={{ paddingLeft: icon ? '36px' : undefined }}
          {...props}
        />
      </div>
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export default Input;
