import React from 'react';

/**
 * Reusable Badge component for severity, status, and system tags.
 * @param {Object} props
 * @param {'default'|'demo'|'critical'|'medium'|'success'|'info'} [props.variant='default']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export function Badge({ variant = 'default', children, className = '', ...props }) {
  const variantClass = {
    default: 'badge',
    demo: 'badge badge-demo',
    critical: 'badge badge-critical',
    medium: 'badge badge-medium',
    success: 'badge badge-success',
    info: 'badge badge-demo',
  }[variant] || 'badge';

  return (
    <span className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export default Badge;
