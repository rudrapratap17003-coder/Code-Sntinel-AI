import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

import { LandingPage } from '../pages/Landing/LandingPage';
import { LoginPage } from '../pages/Login/LoginPage';
import { OverviewPage } from '../pages/Overview/OverviewPage';
import { RepositoryPage } from '../pages/Repository/RepositoryPage';
import { TechnicalDebtPage } from '../pages/TechnicalDebt/TechnicalDebtPage';
import { FindingsPage } from '../pages/Findings/FindingsPage';
import { ArchitecturePage } from '../pages/Architecture/ArchitecturePage';
import { HistoryPage } from '../pages/History/HistoryPage';
import { SettingsPage } from '../pages/Settings/SettingsPage';
import { NotFoundPage } from '../pages/NotFound/NotFoundPage';

import { ROUTES } from '../utils/constants';

export function AppRoutes() {
  return (
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
          <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        </Route>
      </Route>

      {/* 404 Fallback in Root Layout */}
      <Route element={<RootLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
