import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable Button component.
 * @param {Object} props
 * @param {'primary'|'secondary'|'outline'} [props.variant='primary']
 * @param {string} [props.to] - If provided, renders as a react-router Link.
 * @param {React.ReactNode} [props.icon] - Optional leading icon component.
 * @param {React.ReactNode} [props.iconEnd] - Optional trailing icon component.
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export function Button({
  variant = 'primary',
  to,
  icon,
  iconEnd,
  children,
  className = '',
  disabled = false,
  ...props
}) {
  const baseClass = `btn btn-${variant} ${className}`.trim();

  if (to && !disabled) {
    return (
      <Link to={to} className={baseClass} {...props}>
        {icon && <span className="btn-icon-start">{icon}</span>}
        <span>{children}</span>
        {iconEnd && <span className="btn-icon-end">{iconEnd}</span>}
      </Link>
    );
  }

  return (
    <button className={baseClass} disabled={disabled} {...props}>
      {icon && <span className="btn-icon-start">{icon}</span>}
      <span>{children}</span>
      {iconEnd && <span className="btn-icon-end">{iconEnd}</span>}
    </button>
  );
}

export default Button;
