import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoadingState } from '../components/ui/LoadingState';
import { ROUTES } from '../utils/constants';

// Lazy-loaded page components for route-based code splitting
const LandingPage = lazy(() => import('../pages/Landing/LandingPage').then(m => ({ default: m.LandingPage || m.default })));
const LoginPage = lazy(() => import('../pages/Login/LoginPage').then(m => ({ default: m.LoginPage || m.default })));
const OverviewPage = lazy(() => import('../pages/Overview/OverviewPage').then(m => ({ default: m.OverviewPage || m.default })));
const RepositoryPage = lazy(() => import('../pages/Repository/RepositoryPage').then(m => ({ default: m.RepositoryPage || m.default })));
const TechnicalDebtPage = lazy(() => import('../pages/TechnicalDebt/TechnicalDebtPage').then(m => ({ default: m.TechnicalDebtPage || m.default })));
const FindingsPage = lazy(() => import('../pages/Findings/FindingsPage').then(m => ({ default: m.FindingsPage || m.default })));
const ArchitecturePage = lazy(() => import('../pages/Architecture/ArchitecturePage').then(m => ({ default: m.ArchitecturePage || m.default })));
const TrendsPage = lazy(() => import('../pages/Trends/TrendsPage').then(m => ({ default: m.TrendsPage || m.default })));
const ComparePage = lazy(() => import('../pages/Compare/ComparePage').then(m => ({ default: m.ComparePage || m.default })));
const InsightsPage = lazy(() => import('../pages/Insights/InsightsPage').then(m => ({ default: m.InsightsPage || m.default })));
const ReportPage = lazy(() => import('../pages/Report/ReportPage').then(m => ({ default: m.ReportPage || m.default })));
const HistoryPage = lazy(() => import('../pages/History/HistoryPage').then(m => ({ default: m.HistoryPage || m.default })));
const SettingsPage = lazy(() => import('../pages/Settings/SettingsPage').then(m => ({ default: m.SettingsPage || m.default })));
const NotFoundPage = lazy(() => import('../pages/NotFound/NotFoundPage').then(m => ({ default: m.NotFoundPage || m.default })));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        width: '100%',
      }}
    >
      <LoadingState message="Loading page..." size="lg" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Public Landing Page */}
        <Route element={<RootLayout />}>
          <Route path={ROUTES.HOME} element={<LandingPage />} />
        </Route>

        {/* Standalone Login Page */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        {/* Protected Dashboard Shell Layout (Requires Active Demo Session) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.OVERVIEW} element={<OverviewPage />} />
            <Route path={ROUTES.REPOSITORY} element={<RepositoryPage />} />
            <Route path={ROUTES.TECHNICAL_DEBT} element={<TechnicalDebtPage />} />
            <Route path={ROUTES.FINDINGS} element={<FindingsPage />} />
            <Route path={ROUTES.ARCHITECTURE} element={<ArchitecturePage />} />
            <Route path={ROUTES.TRENDS} element={<TrendsPage />} />
            <Route path={ROUTES.COMPARE} element={<ComparePage />} />
            <Route path={ROUTES.INSIGHTS} element={<InsightsPage />} />
            <Route path={ROUTES.REPORT} element={<ReportPage />} />
            <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
          </Route>
        </Route>

        {/* 404 Fallback in Root Layout */}
        <Route element={<RootLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
