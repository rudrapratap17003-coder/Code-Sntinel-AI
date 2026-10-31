import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Flame,
  Layers,
  ShieldCheck,
  Compass,
  LogIn,
  GitBranch,
  Copy,
  AlertTriangle,
  Cpu,
  Bot,
  Play,
  CheckCircle2,
} from 'lucide-react';
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

  const handleStartAnalysis = () => {
    enterDemoSession();
    navigate(ROUTES.REPOSITORY);
  };

  const WORKFLOW_STEPS = [
    { step: '01', title: 'GitHub Repository', desc: 'Public Python repository URL' },
    { step: '02', title: 'Static AST Engine', desc: 'Safe sandbox, no code execution' },
    { step: '03', title: 'Debt & Hotspots', desc: 'Line-level evidence & coupling' },
    { step: '04', title: 'CMDI Score', desc: '0–100 explainable risk index' },
    { step: '05', title: 'Remediation', desc: 'Actionable & AI advisory guidance' },
  ];

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

        {/* Primary Call to Actions */}
        <div className="hero-actions">
          <Button
            onClick={handleStartAnalysis}
            variant="primary"
            size="lg"
            icon={<Play size={18} />}
          >
            Analyze a Repository
          </Button>

          <Button
            onClick={handleEnterDemo}
            variant="secondary"
            size="lg"
            iconEnd={<ArrowRight size={18} />}
          >
            Enter Demo Workspace
          </Button>

          <Button
            to={isDemoSession ? ROUTES.OVERVIEW : ROUTES.LOGIN}
            variant="outline"
            size="lg"
            icon={<LogIn size={18} />}
          >
            {isDemoSession ? 'Dashboard Shell' : 'Sign In'}
          </Button>
        </div>

        {/* 5-Step Explainable Workflow Strip */}
        <div
          style={{
            margin: 'var(--space-2xl) 0 var(--space-xl)',
            width: '100%',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg) var(--space-md)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-accent-primary)',
              marginBottom: 'var(--space-md)',
              textAlign: 'center',
            }}
          >
            Explainable Analysis Architecture
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-md)',
              position: 'relative',
            }}
          >
            {WORKFLOW_STEPS.map((ws, idx) => (
              <div
                key={ws.step}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: 'var(--space-sm)',
                  backgroundColor: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-accent-primary)',
                    fontWeight: 'bold',
                    marginBottom: '4px',
                  }}
                >
                  STEP {ws.step}
                </span>
                <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                  {ws.title}
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {ws.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 6 Core Platform Intelligence Features */}
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Flame size={22} color="var(--color-severity-critical)" />
            </div>
            <h3 className="feature-title">Maintainability Hotspots</h3>
            <p className="feature-description">
              Isolate code locations where cyclomatic complexity, high fan-out, and cognitive load intersect to create friction and technical risk.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <ShieldCheck size={22} color="var(--color-accent-primary)" />
            </div>
            <h3 className="feature-title">Evidence-Based Findings</h3>
            <p className="feature-description">
              Every flagged issue includes verified AST evidence, line ranges, and factual explanations rather than ungrounded assumptions.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Layers size={22} color="var(--color-severity-info)" />
            </div>
            <h3 className="feature-title">Architectural Coupling</h3>
            <p className="feature-description">
              Extract module import graphs, compute afferent/efferent coupling depth, and identify circular dependency cycles via Tarjan's SCC.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Copy size={22} color="var(--color-severity-medium)" />
            </div>
            <h3 className="feature-title">Duplication Detection</h3>
            <p className="feature-description">
              Identify verbatim and near-duplicate logic blocks across Python modules using an optimized sliding window token hash detector.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <AlertTriangle size={22} color="var(--color-severity-warning)" />
            </div>
            <h3 className="feature-title">Error-Handling Quality</h3>
            <p className="feature-description">
              Detect swallowed exceptions, bare `except:` clauses, and silent pass statements that obscure production failures.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Bot size={22} color="#A855F7" />
            </div>
            <h3 className="feature-title">CMDI & AI Explanations</h3>
            <p className="feature-description">
              Calculate an explainable 0–100 maintainability debt index and generate contextual refactoring guidance with Google Gemini.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
