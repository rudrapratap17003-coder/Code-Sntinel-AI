import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';

/**
 * Route protection for demo workspace pages.
 *
 * NOTE: Client-side route checks are not security boundaries.
 * They structure navigation flow and ensure an active demo session is registered
 * before entering dashboard routes. Real access controls will be enforced server-side
 * in the FastAPI backend in Phase 10.
 */
export function ProtectedRoute({ children }) {
  const { isDemoSession } = useAuth();
  const location = useLocation();

  if (!isDemoSession) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}

export default ProtectedRoute;
