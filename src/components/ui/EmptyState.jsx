import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Empty state fallback component.
 * @param {Object} props
 * @param {string} [props.title='No data found']
 * @param {string} [props.description='There is no information to display for this view.']
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.className='']
 */
export function EmptyState({
  title = 'No data found',
  description = 'There is no information to display for this view.',
  icon,
  action,
  className = '',
  ...props
}) {
  return (
    <div className={`empty-state ${className}`.trim()} {...props}>
      <div className="empty-state-icon">
        {icon || <Inbox size={24} />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {action && <div className="empty-state-actions">{action}</div>}
    </div>
  );
}

export default EmptyState;
