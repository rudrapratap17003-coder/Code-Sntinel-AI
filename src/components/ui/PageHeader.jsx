import React from 'react';

/**
 * Standardized Page Header component.
 * @param {Object} props
 * @param {string} props.title
 * @param {React.ReactNode} [props.icon]
 * @param {string|React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.actions]
 * @param {React.ReactNode} [props.breadcrumbs]
 * @param {string} [props.className='']
 */
export function PageHeader({
  title,
  icon,
  description,
  actions,
  breadcrumbs,
  className = '',
  ...props
}) {
  return (
    <div className={`page-header ${className}`.trim()} {...props}>
      {breadcrumbs && <div className="page-header-breadcrumbs">{breadcrumbs}</div>}
      <div className="page-header-top">
        <h1 className="page-header-title">
          {icon && <span style={{ color: 'var(--color-accent-primary)' }}>{icon}</span>}
          <span>{title}</span>
        </h1>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {description && <p className="page-header-desc">{description}</p>}
    </div>
  );
}

export default PageHeader;
