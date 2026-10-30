import React from 'react';

/**
 * Accessible Tooltip component.
 * @param {Object} props
 * @param {string} props.content - Text to show in tooltip
 * @param {React.ReactNode} props.children - Trigger element
 * @param {string} [props.className]
 */
export function Tooltip({ content, children, className = '' }) {
  if (!content) return children;

  return (
    <div className={`tooltip-container ${className}`.trim()} tabIndex={0} role="tooltip">
      {children}
      <span className="tooltip-box" aria-hidden="true">
        {content}
      </span>
    </div>
  );
}

export default Tooltip;
