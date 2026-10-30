import React from 'react';

/**
 * Reusable Card component with modular subcomponents.
 */
export function Card({
  children,
  elevated = false,
  className = '',
  ...props
}) {
  const cardClass = `card ${elevated ? 'card-elevated' : ''} ${className}`.trim();
  return (
    <div className={cardClass} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  children,
  className = '',
  ...props
}) {
  return (
    <div className={`card-header ${className}`.trim()} {...props}>
      <div>
        {title && <h3 className="card-title">{title}</h3>}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="card-header-actions">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className = '', ...props }) {
  return (
    <div className={`card-body ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`card-footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export default Card;
