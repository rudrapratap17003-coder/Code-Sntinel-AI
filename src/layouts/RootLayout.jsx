import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Sparkles, Play, LogIn, ArrowRight } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { APP_CONFIG, ROUTES } from '../utils/constants';
import { useAuth } from '../context/AuthContext';

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDemoSession, enterDemoSession } = useAuth();
  const isLanding = location.pathname === ROUTES.HOME;

  const handleStartAnalysis = () => {
    enterDemoSession();
    navigate(ROUTES.REPOSITORY);
  };

  const scrollToSection = (id) => {
    if (!isLanding) {
      navigate(`${ROUTES.HOME}#${id}`);
      return;
    }
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="app-shell">
      {/* Top SaaS Header */}
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

        {/* Center SaaS Nav Links */}
        <nav className="saas-nav-links" aria-label="Product navigation">
          <button
            type="button"
            className="saas-nav-link"
            onClick={() => scrollToSection('product-value')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Product
          </button>
          <button
            type="button"
            className="saas-nav-link"
            onClick={() => scrollToSection('features')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Features
          </button>
          <button
            type="button"
            className="saas-nav-link"
            onClick={() => scrollToSection('how-it-works')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            How It Works
          </button>
          <Link to={ROUTES.OVERVIEW} className="saas-nav-link">
            Docs &amp; Specs
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="header-meta">
          <Link
            to={isDemoSession ? ROUTES.OVERVIEW : ROUTES.LOGIN}
            className="saas-nav-link"
            style={{ marginRight: 'var(--space-xs)' }}
          >
            {isDemoSession ? 'Dashboard Shell' : 'Sign In'}
          </Link>
          <Button
            onClick={handleStartAnalysis}
            variant="primary"
            size="sm"
            icon={<Play size={13} />}
          >
            Analyze Repository
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <div key={location.pathname} className="page-transition-container">
          <Outlet />
        </div>
      </main>

      {/* Comprehensive Multi-Column SaaS Footer */}
      <footer className="saas-footer">
        <div className="saas-footer-grid">
          {/* Brand Info */}
          <div>
            <Link to={ROUTES.HOME} className="brand-group" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="brand-icon">
                <Shield size={18} strokeWidth={2.4} />
              </div>
              <div className="brand-title">
                CodeSentinel <span>AI</span>
              </div>
            </Link>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: '1.6', maxWidth: '320px' }}>
              {APP_CONFIG.tagline}. Explainable code intelligence platform uncovering architectural risks and technical debt through static AST analysis.
            </p>
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <Badge variant="demo">
                <Sparkles size={11} />
                <span>{APP_CONFIG.mode}</span>
              </Badge>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                v{APP_CONFIG.version}
              </span>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <div className="footer-col-title">Platform</div>
            <ul className="footer-nav-list">
              <li>
                <Link to={ROUTES.OVERVIEW} className="footer-nav-link">Executive Overview</Link>
              </li>
              <li>
                <Link to={ROUTES.REPOSITORY} className="footer-nav-link">Analyze Repository</Link>
              </li>
              <li>
                <Link to={ROUTES.TECHNICAL_DEBT} className="footer-nav-link">CMDI Scoring</Link>
              </li>
              <li>
                <Link to={ROUTES.FINDINGS} className="footer-nav-link">Findings Ledger</Link>
              </li>
              <li>
                <Link to={ROUTES.ARCHITECTURE} className="footer-nav-link">Architecture Graph</Link>
              </li>
            </ul>
          </div>

          {/* Intelligence Links */}
          <div>
            <div className="footer-col-title">Intelligence</div>
            <ul className="footer-nav-list">
              <li>
                <Link to={ROUTES.TRENDS} className="footer-nav-link">Historical CMDI Trends</Link>
              </li>
              <li>
                <Link to={ROUTES.COMPARE} className="footer-nav-link">Snapshot Comparison</Link>
              </li>
              <li>
                <Link to={ROUTES.INSIGHTS} className="footer-nav-link">Module Hotspots</Link>
              </li>
              <li>
                <Link to={ROUTES.REPORT} className="footer-nav-link">Developer Report</Link>
              </li>
              <li>
                <Link to={ROUTES.HISTORY} className="footer-nav-link">Analysis History</Link>
              </li>
            </ul>
          </div>

          {/* Engineering Assurance */}
          <div>
            <div className="footer-col-title">Assurance</div>
            <ul className="footer-nav-list" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              <li style={{ lineHeight: '1.5' }}>
                Zero proprietary code uploads or permanent storage.
              </li>
              <li style={{ lineHeight: '1.5' }}>
                Deterministic AST parsing and McCabe cyclomatic complexity.
              </li>
              <li style={{ lineHeight: '1.5' }}>
                Tarjan's SCC algorithm for cycle detection.
              </li>
              <li style={{ lineHeight: '1.5' }}>
                Transparent, explainable CMDI calculation.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="footer-bottom-bar">
          <div>
            © 2026 {APP_CONFIG.name}. Built for software engineering teams.
          </div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            Sandboxed Environment • Zero Third-Party Uploads
          </div>
        </div>
      </footer>
    </div>
  );
}

export default RootLayout;
