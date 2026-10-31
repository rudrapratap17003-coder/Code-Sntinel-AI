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
  Activity,
  Code2,
  FileCode,
  Network,
  TrendingUp,
  Sparkles,
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

  const scrollToFeatures = () => {
    const elem = document.getElementById('features');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const WORKFLOW_STEPS = [
    {
      step: '01',
      title: 'Connect GitHub Repository',
      desc: 'Provide any public Python repository URL without needing SSH keys or credentials.',
    },
    {
      step: '02',
      title: 'Analyze Source Code',
      desc: 'AST static parsing calculates McCabe complexity, token clones, and import graphs in memory.',
    },
    {
      step: '03',
      title: 'Detect Technical Debt',
      desc: 'Pinpoint line-level cognitive bottlenecks, circular dependencies, and error handling flaws.',
    },
    {
      step: '04',
      title: 'Understand Risk and CMDI',
      desc: 'Review the transparent 0–100 Maintainability Debt Index with indicator contributions.',
    },
    {
      step: '05',
      title: 'Improve and Track Code Health',
      desc: 'Execute prioritized refactoring roadmaps and track historical trajectory across commits.',
    },
  ];

  const PRODUCT_VALUES = [
    {
      icon: <Flame size={22} color="var(--color-severity-critical)" />,
      title: 'Technical Debt Intelligence',
      desc: 'Pinpoint cognitive overload, excessive branching, and structural friction before they manifest as customer-facing incidents or velocity bottlenecks.',
    },
    {
      icon: <Activity size={22} color="var(--color-accent-primary)" />,
      title: 'CMDI Maintainability Scoring',
      desc: 'A transparent, project-defined 0–100 index combining complexity, coupling, duplication, and error-handling without black-box opacity.',
    },
    {
      icon: <Network size={22} color="var(--color-severity-info)" />,
      title: 'Architecture Insights',
      desc: "Uncover tightly coupled modules, afferent/efferent blast radius, and circular dependency cycles detected via Tarjan's SCC algorithm.",
    },
    {
      icon: <ShieldCheck size={22} color="var(--color-accent-secondary)" />,
      title: 'Intelligent Prioritization',
      desc: 'Separate trivial stylistic linter noise from high-blast-radius architectural debt requiring immediate senior engineering attention.',
    },
    {
      icon: <TrendingUp size={22} color="#38C8FF" />,
      title: 'Historical Code Health',
      desc: 'Track debt trajectories across commits and pull requests to ensure engineering refactoring investments yield measurable debt reductions.',
    },
    {
      icon: <Bot size={22} color="#A855F7" />,
      title: 'AI-Assisted Explanations',
      desc: 'Receive deep contextual explanations, risk trade-offs, and refactoring roadmaps powered by Google Gemini with verified AST grounding.',
    },
  ];

  return (
    <div className="container" style={{ paddingBottom: 'var(--space-3xl)' }}>
      {/* ------------------------------------------------------------------ */}
      {/* SECTION B: Hero Section                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="hero-section">
        <div className="hero-pill">
          <Badge variant="demo">
            <Compass size={12} />
            <span>Explainable Technical-Debt Intelligence Platform</span>
          </Badge>
        </div>

        <h1 className="hero-title">
          Your Code Has Hidden Debt.{' '}
          <span className="highlight">Now You Can See It.</span>
        </h1>

        <p className="hero-description" style={{ maxWidth: '720px' }}>
          Analyze your GitHub repositories, uncover maintainability risks, understand architectural problems and track technical debt over time.
        </p>

        {/* Primary Call to Actions */}
        <div className="hero-actions">
          <Button
            onClick={handleStartAnalysis}
            variant="primary"
            size="lg"
            icon={<Play size={18} />}
          >
            Analyze Repository
          </Button>

          <Button
            onClick={scrollToFeatures}
            variant="secondary"
            size="lg"
            iconEnd={<ArrowRight size={18} />}
          >
            Explore Features
          </Button>

          <Button
            onClick={handleEnterDemo}
            variant="outline"
            size="lg"
            icon={<Sparkles size={16} />}
          >
            Enter Demo Workspace
          </Button>
        </div>

        {/* Interactive Dashboard / Code-Analysis Illustration Preview */}
        <div className="dashboard-mockup-container">
          <div className="dashboard-mockup-card">
            {/* Window chrome header */}
            <div className="mockup-window-header">
              <div className="mockup-window-dots">
                <span className="mockup-dot mockup-dot-red" />
                <span className="mockup-dot mockup-dot-amber" />
                <span className="mockup-dot mockup-dot-green" />
              </div>
              <div className="mockup-window-title">
                <GitBranch size={13} style={{ color: 'var(--color-accent-primary)' }} />
                <span>psf/requests • branch:main (commit: 8d2c4e1)</span>
              </div>
              <Badge variant="success" style={{ fontSize: '10px' }}>
                STATIC AST AUDIT COMPLETE
              </Badge>
            </div>

            {/* Mockup Body: Split View with Score Gauge & Live Code Evidence */}
            <div className="mockup-body">
              {/* Left Column: Metrics & Indicators */}
              <div className="mockup-metrics-panel">
                <div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Code Maintainability Debt Index
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '32px', fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--color-text-primary)' }}>
                      38.4
                    </span>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      / 100
                    </span>
                    <Badge variant="medium" style={{ marginLeft: 'auto', fontSize: '11px' }}>
                      MODERATE RISK
                    </Badge>
                  </div>
                </div>

                {/* 4 Indicator Contribution Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                      <span>Function Complexity</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>64%</span>
                    </div>
                    <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                      <div className="progress-fill" style={{ width: '64%', background: 'var(--color-severity-medium)' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                      <span>Architectural Coupling</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>48%</span>
                    </div>
                    <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                      <div className="progress-fill" style={{ width: '48%', background: 'var(--color-severity-info)' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                      <span>Code Duplication</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>22%</span>
                    </div>
                    <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                      <div className="progress-fill" style={{ width: '22%', background: 'var(--color-accent-primary)' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                      <span>Error Handling</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>18%</span>
                    </div>
                    <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                      <div className="progress-fill" style={{ width: '18%', background: 'var(--color-accent-primary)' }} />
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span>Files Analyzed: <strong>48</strong></span>
                  <span>Circular Cycles: <strong>0</strong></span>
                </div>
              </div>

              {/* Right Column: Code Snippet & AST Finding Evidence */}
              <div className="mockup-code-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-severity-critical)' }}>
                    <Flame size={14} />
                    <span style={{ fontWeight: '600', fontSize: '11px' }}>HOTSPOT: requests/models.py • L142-L178</span>
                  </div>
                  <span style={{ color: 'var(--color-accent-primary)', fontSize: '10px', background: 'rgba(0, 245, 160, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    MCCABE v(G) = 18
                  </span>
                </div>

                <div style={{ color: '#7E8B83' }}>
                  <span style={{ color: '#55C7E8' }}>def</span>{' '}
                  <span style={{ color: '#00F5A0' }}>prepare_auth</span>(self, auth, url=None):
                </div>
                <div style={{ color: '#7E8B83', paddingLeft: '16px' }}>
                  <span style={{ color: '#9AA79F' }}># Critical branch density: 7 nested decision gates</span>
                </div>
                <div style={{ color: '#F4F7F5', paddingLeft: '16px', background: 'rgba(255, 93, 104, 0.08)', borderLeft: '2px solid #FF5D68', marginLeft: '-8px', paddingRight: '8px' }}>
                  <span style={{ color: '#FF5D68' }}>if</span> auth <span style={{ color: '#FF5D68' }}>is None</span>:
                </div>
                <div style={{ color: '#F4F7F5', paddingLeft: '32px' }}>
                  url_auth = get_auth_from_url(self.url)
                </div>
                <div style={{ color: '#F4F7F5', paddingLeft: '32px', background: 'rgba(255, 93, 104, 0.08)', borderLeft: '2px solid #FF5D68', marginLeft: '-8px', paddingRight: '8px' }}>
                  <span style={{ color: '#FF5D68' }}>if</span> url_auth:
                </div>
                <div style={{ color: '#F4F7F5', paddingLeft: '48px' }}>
                  auth = url_auth
                </div>
                <div style={{ color: '#7E8B83', paddingLeft: '16px', marginTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--color-accent-primary)' }}>✦ Recommendation:</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Extract URL credential parsing into dedicated authenticator strategy.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION C: Product Value Section                                   */}
      {/* ------------------------------------------------------------------ */}
      <section id="product-value" style={{ margin: 'var(--space-3xl) 0' }}>
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto var(--space-xl)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent-primary)', display: 'block', marginBottom: '8px' }}>
            Product Value
          </span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', fontWeight: '800', letterSpacing: '-0.025em', color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>
            Engineering Intelligence Designed for Modern Codebases
          </h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
            Move beyond noisy stylistic linters to deep architectural health assessment grounded in verifiable AST metrics.
          </p>
        </div>

        <div className="product-value-grid">
          {PRODUCT_VALUES.map((pv) => (
            <div key={pv.title} className="value-card">
              <div className="feature-icon-wrapper">{pv.icon}</div>
              <h3 className="feature-title" style={{ fontSize: '1.1rem' }}>{pv.title}</h3>
              <p className="feature-description">{pv.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION D: How It Works (5-Step Workflow)                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="workflow-strip-container">
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto var(--space-xl)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent-primary)', display: 'block', marginBottom: '8px' }}>
            Workflow Pipeline
          </span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', fontWeight: '800', letterSpacing: '-0.025em', color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>
            Five Steps to Complete Technical-Debt Clarity
          </h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>
            Zero code execution, zero credential leakage, and 100% explainable metrics.
          </p>
        </div>

        <div className="workflow-steps-grid">
          {WORKFLOW_STEPS.map((ws) => (
            <div key={ws.step} className="workflow-step-card">
              <span className="workflow-step-num">
                STEP {ws.step}
              </span>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                {ws.title}
              </h4>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: '1.5', margin: 0 }}>
                {ws.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION E: Features Grid                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="features" style={{ margin: 'var(--space-3xl) 0' }}>
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto var(--space-xl)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent-primary)', display: 'block', marginBottom: '8px' }}>
            Platform Features
          </span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', fontWeight: '800', letterSpacing: '-0.025em', color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>
            Deep Architectural Visibility
          </h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>
            Every finding links directly to line coordinates, AST evidence, and actionable next steps.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Flame size={22} color="var(--color-severity-critical)" />
            </div>
            <h3 className="feature-title">Maintainability Hotspots</h3>
            <p className="feature-description">
              Isolate modules where cyclomatic complexity, high afferent fan-out, and cognitive load intersect to create friction and technical risk.
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

      {/* ------------------------------------------------------------------ */}
      {/* SECTION F: Final CTA Section                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="final-cta-section">
        <h2 className="final-cta-title">
          Build Faster. Maintain Better.
        </h2>
        <p className="final-cta-desc">
          Gain immediate architectural visibility into your code maintainability debt in seconds. No credit card, no SSH keys, and no code retention.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            onClick={handleStartAnalysis}
            variant="primary"
            size="lg"
            icon={<Play size={18} />}
          >
            Start Analyzing Your Repository
          </Button>
          <Button
            onClick={handleEnterDemo}
            variant="secondary"
            size="lg"
            iconEnd={<ArrowRight size={18} />}
          >
            Explore Demo Workspace
          </Button>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
