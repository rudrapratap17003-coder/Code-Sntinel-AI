import React, { useState } from 'react';
import { Menu, GitFork, Sparkles, User, Check, PlusCircle } from 'lucide-react';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { APP_CONFIG, ROUTES } from '../utils/constants';
import { useAnalysis } from '../context/AnalysisContext';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Shared Application Top Navigation Bar.
 * @param {Object} props
 * @param {Function} props.onToggleSidebar
 */
export function TopNavigation({ onToggleSidebar }) {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const { currentAnalysis, isDemoMode, loadDemoAnalysis } = useAnalysis();
  const { user, isDemoSession, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    setShowDemoModal(false);
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <>
      <header className="dashboard-topbar">
        <div className="topbar-left">
          <button
            className="mobile-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
          <div className="topbar-breadcrumbs">
            <Breadcrumbs />
          </div>
        </div>

        <div className="topbar-right">
          {/* Active Target Repository Label */}
          {currentAnalysis ? (
            <div className="repo-pill" title={`Target Repository: ${currentAnalysis.repository.name}`}>
              <GitFork size={13} style={{ color: 'var(--color-accent-primary)' }} />
              <span>{currentAnalysis.repository.name}</span>
              {isDemoMode && (
                <span style={{ color: 'var(--color-severity-info)', opacity: 0.8 }}>[demo]</span>
              )}
            </div>
          ) : (
            <Link
              to={ROUTES.REPOSITORY}
              className="repo-pill"
              style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
              title="Click to select or analyze a repository"
            >
              <PlusCircle size={13} />
              <span>No Repo Selected</span>
            </Link>
          )}

          {/* Explicit Analysis Mode Indicator */}
          <Badge
            variant={isDemoMode ? 'demo' : 'success'}
            onClick={() => setShowDemoModal(true)}
            style={{ cursor: 'pointer' }}
          >
            <Sparkles size={11} />
            <span>{isDemoMode ? APP_CONFIG.mode : 'REAL ANALYSIS'}</span>
          </Badge>

          {/* User / Demo Environment Action */}
          <button
            className="user-menu-btn"
            onClick={() => setShowDemoModal(true)}
            aria-label="Open Environment & Provenance Status"
          >
            <User size={13} />
            <span>{user?.name || 'Demo User'}</span>
          </button>
        </div>
      </header>

      {/* Demo Environment & User Session Dialog */}
      <ConfirmDialog
        isOpen={showDemoModal}
        title="Session & Environment Status"
        onCancel={() => setShowDemoModal(false)}
        onConfirm={handleLogout}
        confirmLabel="Sign Out / Exit Demo"
        cancelLabel="Close"
        isDanger={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-sm)' }}>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>{user?.name || 'Demo User'}</strong>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {user?.email || 'demo@codesentinel.ai'}
              </div>
            </div>
            <Badge variant="demo">{isDemoSession ? 'DEMO SESSION' : 'GUEST'}</Badge>
          </div>

          <p>
            You are currently operating in <strong>{APP_CONFIG.mode}</strong>.
          </p>

          <div
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-xs)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-accent-primary)' }}>
              <Check size={14} />
              <span>Deterministic demonstration data active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-accent-primary)' }}>
              <Check size={14} />
              <span>Zero real repository clones or remote code uploads</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-accent-primary)' }}>
              <Check size={14} />
              <span>Client-side session active for product evaluation</span>
            </div>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Demo access is for evaluating the product and does not represent secure authentication.
            To exit this demonstration session, click "Sign Out / Exit Demo".
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}

export default TopNavigation;
