import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  GitBranch,
  Flame,
  ShieldAlert,
  Network,
  History,
  Settings,
  X,
  Sparkles,
  LogOut,
  TrendingUp,
  GitCompare,
  Lightbulb,
  FileText,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { ROUTES, APP_CONFIG } from '../utils/constants';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Overview', to: ROUTES.OVERVIEW, icon: <LayoutDashboard size={18} /> },
  { label: 'Repository Analysis', to: ROUTES.REPOSITORY, icon: <GitBranch size={18} /> },
  { label: 'Technical Debt', to: ROUTES.TECHNICAL_DEBT, icon: <Flame size={18} /> },
  { label: 'Findings', to: ROUTES.FINDINGS, icon: <ShieldAlert size={18} /> },
  { label: 'Architecture', to: ROUTES.ARCHITECTURE, icon: <Network size={18} /> },
  { label: 'CMDI Trends', to: ROUTES.TRENDS, icon: <TrendingUp size={18} /> },
  { label: 'Compare Snapshots', to: ROUTES.COMPARE, icon: <GitCompare size={18} /> },
  { label: 'Insights & Hotspots', to: ROUTES.INSIGHTS, icon: <Lightbulb size={18} /> },
  { label: 'Developer Report', to: ROUTES.REPORT, icon: <FileText size={18} /> },
  { label: 'History', to: ROUTES.HISTORY, icon: <History size={18} /> },
  { label: 'Settings', to: ROUTES.SETTINGS, icon: <Settings size={18} /> },
];

/**
 * Shared Application Sidebar component.
 * @param {Object} props
 * @param {boolean} [props.isOpen] - Mobile drawer state
 * @param {Function} [props.onClose] - Mobile close callback
 */
export function Sidebar({ isOpen = false, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleSignOut = () => {
    if (onClose) onClose();
    logout();
    navigate(ROUTES.LOGIN);
  };
  return (
    <aside className={`dashboard-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <Link to={ROUTES.OVERVIEW} className="sidebar-brand" onClick={onClose} aria-label="CodeSentinel Home">
          <div className="sidebar-logo">
            <Shield size={18} strokeWidth={2.4} />
          </div>
          <div className="sidebar-title">
            CodeSentinel <span>AI</span>
          </div>
        </Link>
        {onClose && (
          <button
            className="mobile-menu-btn"
            onClick={onClose}
            aria-label="Close menu"
            style={{ display: isOpen ? 'flex' : undefined }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Main Navigation">
        <div className="nav-section-title">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-meta-row">
          <span>Engine Status</span>
          <Badge variant="demo">
            <Sparkles size={10} />
            <span>{APP_CONFIG.mode}</span>
          </Badge>
        </div>
        <div className="sidebar-meta-row" style={{ marginTop: '4px', opacity: 0.7 }}>
          <span>Version</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>v{APP_CONFIG.version}</span>
        </div>
        <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-xs)', borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={handleSignOut}
            className="nav-link"
            style={{
              padding: '6px 8px',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              width: '100%',
              justifyContent: 'flex-start',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Sign out / Exit demo session"
          >
            <LogOut size={14} />
            <span>Sign Out / Exit Demo</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
