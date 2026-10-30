import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { ROUTES } from '../../utils/constants';

/**
 * Breadcrumbs navigation component.
 * Can take custom items or automatically generate based on active pathname.
 * @param {Object} props
 * @param {Array<{label: string, to?: string}>} [props.items]
 */
export function Breadcrumbs({ items }) {
  const location = useLocation();

  const routeNameMap = {
    [ROUTES.HOME]: 'Home',
    [ROUTES.OVERVIEW]: 'Overview',
    [ROUTES.REPOSITORY]: 'Repository Analysis',
    [ROUTES.TECHNICAL_DEBT]: 'Technical Debt',
    [ROUTES.FINDINGS]: 'Findings',
    [ROUTES.ARCHITECTURE]: 'Architecture',
    [ROUTES.HISTORY]: 'History',
    [ROUTES.SETTINGS]: 'Settings',
  };

  const breadcrumbList = items || [
    { label: 'Workspace', to: ROUTES.OVERVIEW },
    { label: routeNameMap[location.pathname] || 'Current View' },
  ];

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to={ROUTES.OVERVIEW} className="breadcrumb-item" aria-label="Overview Home">
        <Home size={12} />
      </Link>
      {breadcrumbList.map((item, index) => {
        const isLast = index === breadcrumbList.length - 1;
        return (
          <React.Fragment key={index}>
            <span className="breadcrumb-separator">
              <ChevronRight size={10} />
            </span>
            {item.to && !isLast ? (
              <Link to={item.to} className="breadcrumb-item">
                {item.label}
              </Link>
            ) : (
              <span className={`breadcrumb-item ${isLast ? 'active' : ''}`} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
