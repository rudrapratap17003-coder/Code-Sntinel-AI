import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable Button component for CodeSentinel AI.
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'outline'|'ghost'|'danger'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.fullWidth=false]
 * @param {string} [props.to] - If provided, renders as a react-router Link.
 * @param {React.ReactNode} [props.icon] - Optional leading icon component.
 * @param {React.ReactNode} [props.iconEnd] - Optional trailing icon component.
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 * @param {boolean} [props.disabled=false]
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  to,
  icon,
  iconEnd,
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;
  const sizeClass = size !== 'md' ? `btn-${size}` : '';
  const widthClass = fullWidth ? 'btn-block' : '';
  const loadingClass = loading ? 'btn-loading' : '';
  const baseClass = `btn btn-${variant} ${sizeClass} ${widthClass} ${loadingClass} ${className}`.trim();

  if (to && !isDisabled) {
    return (
      <Link to={to} className={baseClass} {...props}>
        {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon && <span className="btn-icon-start">{icon}</span>}
        <span>{children}</span>
        {!loading && iconEnd && <span className="btn-icon-end">{iconEnd}</span>}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={baseClass}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon && <span className="btn-icon-start">{icon}</span>}
      <span>{children}</span>
      {!loading && iconEnd && <span className="btn-icon-end">{iconEnd}</span>}
    </button>
  );
}

export default Button;
