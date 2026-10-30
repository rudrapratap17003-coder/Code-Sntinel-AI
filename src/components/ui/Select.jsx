import React from 'react';

/**
 * Reusable Select Dropdown component.
 * @param {Object} props
 * @param {string} [props.label]
 * @param {Array<{value: string, label: string}>} props.options
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {string} [props.className]
 */
export function Select({
  label,
  options = [],
  hint,
  error,
  id,
  className = '',
  disabled = false,
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
        </label>
      )}
      <select id={selectId} className="form-select" disabled={disabled} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: 'var(--color-surface-elevated)' }}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export default Select;
