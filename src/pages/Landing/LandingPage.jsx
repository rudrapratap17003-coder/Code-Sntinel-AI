import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, Layers, ShieldCheck, Compass, LogIn } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { APP_CONFIG, ROUTES } from '../../utils/constants';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';

export function LandingPage() {
  useDocumentTitle('See the Debt, Understand the Risk');
  const navigate = useNavigate();
  const { isDemoSession, enterDemoSession } = useAuth();

  const handleEnterDemo = () => {
    enterDemoSession();
    navigate(ROUTES.OVERVIEW);
  };

  return (
    <div className="container">
      <section className="hero-section">
        <div className="hero-pill">
          <Badge variant="demo">
            <Compass size={12} />
            <span>Developer Intelligence Platform</span>
          </Badge>
        </div>

        <h1 className="hero-title">
          CodeSentinel <span className="highlight">AI</span>
        </h1>

        <p className="hero-tagline">{APP_CONFIG.tagline}</p>

        <p className="hero-description">{APP_CONFIG.description}</p>

        <div className="hero-actions">
          <Button
            onClick={handleEnterDemo}
            variant="primary"
            size="lg"
            iconEnd={<ArrowRight size={18} />}
          >
            Enter Demo Workspace
          </Button>
          <Button
            to={isDemoSession ? ROUTES.OVERVIEW : ROUTES.LOGIN}
            variant="secondary"
            size="lg"
            icon={<LogIn size={18} />}
          >
            {isDemoSession ? 'Return to Dashboard' : 'Sign In / Switch'}
          </Button>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Flame size={22} />
            </div>
            <h3 className="feature-title">Maintainability Hotspots</h3>
            <p className="feature-description">
              Identify code areas where cyclomatic complexity, churn, and cognitive load intersect to create the highest delivery friction.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <ShieldCheck size={22} />
            </div>
            <h3 className="feature-title">Evidence-Based Findings</h3>
            <p className="feature-description">
              Every flagged issue includes exact file coordinates, measurable complexity thresholds, and actionable remediation guidance.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Layers size={22} />
            </div>
            <h3 className="feature-title">Architectural Coupling</h3>
            <p className="feature-description">
              Map module dependencies, detect circular references, and evaluate blast radius to maintain modular, scalable systems.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
