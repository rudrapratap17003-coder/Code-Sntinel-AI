import React from 'react';

/**
 * Loading indicator and skeleton placeholder component.
 * @param {Object} props
 * @param {string} [props.message='Loading...']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {'spinner'|'skeleton-card'|'skeleton-table'} [props.variant='spinner']
 * @param {number} [props.count=3]
 * @param {string} [props.className='']
 */
export function LoadingState({
  message = 'Loading...',
  size = 'md',
  variant = 'spinner',
  count = 3,
  className = '',
  ...props
}) {
  if (variant === 'skeleton-card') {
    return (
      <div className={`skeleton-container ${className}`.trim()} role="status" aria-busy="true" {...props}>
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="skeleton-card">
            <div className="skeleton-shimmer skeleton-title" />
            <div className="skeleton-shimmer skeleton-line" />
            <div className="skeleton-shimmer skeleton-line short" />
          </div>
        ))}
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  if (variant === 'skeleton-table') {
    return (
      <div className={`skeleton-table ${className}`.trim()} role="status" aria-busy="true" {...props}>
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="skeleton-table-row">
            <div className="skeleton-shimmer skeleton-cell sm" />
            <div className="skeleton-shimmer skeleton-cell lg" />
            <div className="skeleton-shimmer skeleton-cell md" />
            <div className="skeleton-shimmer skeleton-cell sm" />
          </div>
        ))}
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  const spinnerSize = {
    sm: { width: '16px', height: '16px', borderWidth: '2px' },
    md: { width: '24px', height: '24px', borderWidth: '2px' },
    lg: { width: '32px', height: '32px', borderWidth: '3px' },
  }[size] || { width: '24px', height: '24px', borderWidth: '2px' };

  return (
    <div className={`loading-indicator ${className}`.trim()} role="status" aria-busy="true" {...props}>
      <div className="spinner" style={spinnerSize} />
      {message && <span>{message}</span>}
    </div>
  );
}

export default LoadingState;
