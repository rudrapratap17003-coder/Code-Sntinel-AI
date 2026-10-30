import React from 'react';

/**
 * Loading indicator component.
 * @param {Object} props
 * @param {string} [props.message='Loading...']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.className='']
 */
export function LoadingState({
  message = 'Loading...',
  size = 'md',
  className = '',
  ...props
}) {
  const spinnerSize = {
    sm: { width: '16px', height: '16px', borderWidth: '2px' },
    md: { width: '24px', height: '24px', borderWidth: '2px' },
    lg: { width: '32px', height: '32px', borderWidth: '3px' },
  }[size] || { width: '24px', height: '24px', borderWidth: '2px' };

  return (
    <div className={`loading-indicator ${className}`.trim()} {...props}>
      <div className="spinner" style={spinnerSize} />
      {message && <span>{message}</span>}
    </div>
  );
}

export default LoadingState;
