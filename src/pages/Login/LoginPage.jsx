import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button, Input, ErrorMessage, Card, CardBody } from '../../ui';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { APP_CONFIG, ROUTES } from '../../utils/constants';

export function LoginPage() {
  useDocumentTitle('Sign In');
  const navigate = useNavigate();
  const location = useLocation();
  const { isDemoSession, enterDemoSession } = useAuth();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation State
  const [validationErrors, setValidationErrors] = useState({});
  const [unconfiguredNotice, setUnconfiguredNotice] = useState(false);

  const validateForm = () => {
    const errors = {};

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    setUnconfiguredNotice(false);

    if (!validateForm()) {
      return;
    }

    // STRICT SPEC REQUIREMENT:
    // Do not pretend to validate credentials against a real authentication service.
    // Show a clear not-yet-configured message for Sign In.
    // Do not transmit credentials. Do not store passwords.
    setUnconfiguredNotice(true);
  };

  const handleEnterDemo = () => {
    enterDemoSession();
    const destination = location.state?.from?.pathname || ROUTES.OVERVIEW;
    navigate(destination);
  };

  return (
    <div className="login-page-container">
      <div className="login-card-wrapper">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-brand-icon">
            <Shield size={26} strokeWidth={2.4} />
          </div>

          <h1 className="login-brand-title">
            CodeSentinel <span>AI</span>
          </h1>

          <p className="login-brand-tagline">
            {APP_CONFIG.tagline}
          </p>
        </div>

        {/* Login Card Container */}
        <Card>
          <CardBody style={{ padding: 'var(--space-xl)' }}>
            {/* Demo Status Banner if already authenticated */}
            {isDemoSession && (
              <div className="login-demo-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-accent-primary)' }}>
                  <CheckCircle2 size={15} />
                  <span>Demo session active</span>
                </div>
                <Link
                  to={ROUTES.OVERVIEW}
                  style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-semibold)', textDecoration: 'underline' }}
                >
                  Return to Dashboard →
                </Link>
              </div>
            )}

            {/* Unconfigured Sign-In Message */}
            {unconfiguredNotice && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <ErrorMessage severity="info" title="Authentication Service Unconfigured">
                  Production backend authentication is not yet connected in this demonstration phase. No credentials were transmitted or stored.
                  Please use <strong>Enter Demo Workspace</strong> below for product evaluation.
                </ErrorMessage>
              </div>
            )}

            {/* Primary Action: Demo Workspace Button */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleEnterDemo}
                iconEnd={<ArrowRight size={18} />}
              >
                Enter Demo Workspace
              </Button>
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Instant client-side evaluation with zero credentials required
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="login-divider">
              <span className="login-divider-line" />
              <span className="login-divider-text">
                Or Sign In with Credentials
              </span>
              <span className="login-divider-line" />
            </div>

            {/* Credential Form */}
            <form onSubmit={handleSignInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <Input
                label="Work Email"
                type="email"
                placeholder="developer@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email) setValidationErrors((prev) => ({ ...prev, email: null }));
                }}
                icon={<Mail size={15} />}
                error={validationErrors.email}
              />

              {/* Password with Show/Hide toggle */}
              <div className="form-group">
                <label className="form-label" htmlFor="password-field">
                  Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)', display: 'flex' }}>
                    <Lock size={15} />
                  </span>
                  <input
                    id="password-field"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (validationErrors.password) setValidationErrors((prev) => ({ ...prev, password: null }));
                    }}
                    className={`form-input ${validationErrors.password ? 'form-input-error' : ''}`}
                    style={{ paddingLeft: '36px', paddingRight: '40px' }}
                    aria-invalid={!!validationErrors.password}
                    aria-describedby={validationErrors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {validationErrors.password && (
                  <span id="password-error" className="form-error">{validationErrors.password}</span>
                )}
              </div>

              <Button
                type="submit"
                variant="secondary"
                size="md"
                fullWidth
                style={{ marginTop: 'var(--space-xs)' }}
              >
                Sign In
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Security & Provenance Note */}
        <div className="login-provenance-note">
          <p>
            Demo access is provided for evaluating CodeSentinel AI maintainability intelligence and does not represent secure authentication.
          </p>
          <p style={{ marginTop: '4px', opacity: 0.8 }}>
            Client-side route checks are navigation helpers, not cryptographic security boundaries.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
