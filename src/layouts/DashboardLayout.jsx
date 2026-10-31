import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';

/**
 * Shared Application Dashboard Shell Layout.
 * Used across all main CodeSentinel AI pages.
 */
export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="dashboard-layout">
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Shared Application Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="dashboard-main">
        <TopNavigation onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="dashboard-content">
          <div key={location.pathname} className="page-transition-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
