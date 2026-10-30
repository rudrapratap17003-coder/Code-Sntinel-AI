import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Shield, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { APP_CONFIG, ROUTES } from '../utils/constants';

export function RootLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to={ROUTES.HOME} className="brand-group" aria-label="CodeSentinel AI Home">
          <div className="brand-icon">
            <Shield size={20} strokeWidth={2.2} />
          </div>
          <div className="brand-text-container">
            <div className="brand-title">
              CodeSentinel <span>AI</span>
            </div>
            <div className="brand-subtitle">Technical Debt Intelligence</div>
          </div>
        </Link>

        <div className="header-meta">
          <Badge variant="demo">
            <Sparkles size={12} />
            <span>{APP_CONFIG.mode}</span>
          </Badge>
          <span className="footer-notice" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            v{APP_CONFIG.version}
          </span>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div>
          <span>© 2026 {APP_CONFIG.name}. {APP_CONFIG.tagline}</span>
        </div>
        <div className="footer-notice">
          Demonstration Environment • Zero Third-Party Uploads
        </div>
      </footer>
    </div>
  );
}

export default RootLayout;
