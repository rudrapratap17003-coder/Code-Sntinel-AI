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
  iconEnd,
  id,
  className = '',
  disabled = false,
  ...props
}) {
  const generatedId = React.useId();
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : generatedId);
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)', display: 'flex', pointerEvents: 'none' }}>
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`form-input ${error ? 'input-error' : ''}`}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hintId}
          style={{
            paddingLeft: icon ? '36px' : undefined,
            paddingRight: iconEnd ? '36px' : undefined,
          }}
          {...props}
        />
        {iconEnd && (
          <span style={{ position: 'absolute', right: '12px', display: 'flex', alignItems: 'center' }}>
            {iconEnd}
          </span>
        )}
      </div>
      {hint && !error && (
        <span id={hintId} className="form-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default Input;
