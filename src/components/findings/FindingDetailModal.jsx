import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode,
  Tag,
  Bot,
  Link as LinkIcon,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Copy,
  Check,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { apiClient } from '../../api';

/**
 * Interactive Detail Modal for inspecting a specific maintainability finding,
 * with integrated Gemini AI Explanation & Refactoring guidance.
 *
 * @param {Object} props
 * @param {Object|null} props.finding
 * @param {Function} props.onClose
 * @param {Function} [props.onSelectRelatedFinding]
 */
export function FindingDetailModal({ finding, onClose, onSelectRelatedFinding }) {
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [explanationError, setExplanationError] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Reset explanation state when active finding changes
  useEffect(() => {
    setExplanation(null);
    setExplanationError(null);
    setIsExplaining(false);
    setCopiedSnippet(false);
  }, [finding?.id]);

  // Handle Escape key to close modal & lock body scroll
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!finding) return null;

  const severityVariant = {
    critical: 'critical',
    high: 'critical',
    medium: 'medium',
    low: 'demo',
  }[finding.severity] || 'default';

  const handleRequestExplanation = async (useFallback = false) => {
    setIsExplaining(true);
    setExplanationError(null);

    try {
      const result = await apiClient.explainFinding(finding, { fallback: useFallback });
      setExplanation(result);
    } catch (err) {
      setExplanationError(err.message || 'Failed to generate explanation.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleCopyRefactoring = () => {
    if (explanation?.refactoringExample) {
      navigator.clipboard.writeText(explanation.refactoringExample);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="finding-detail-title"
    >
      <div
        className="modal-dialog"
        style={{ maxWidth: '780px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <Badge variant={severityVariant}>
              {finding.severity.toUpperCase()}
            </Badge>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {finding.id}
            </span>
            <Badge variant="default" style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}>
              Status: {finding.status || 'Open'}
            </Badge>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              • {finding.category}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="modal-body"
          style={{
            maxHeight: '75vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
          }}
        >
          {/* Finding Title & Rule */}
          <div>
            <h3 id="finding-detail-title" style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              {finding.title}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', flexWrap: 'wrap' }}>
              <Tag size={12} />
              <span>Rule:</span>
              <code style={{ color: 'var(--color-accent-primary)' }}>{finding.ruleId || finding.rule_id}</code>
              <span style={{ margin: '0 4px' }}>•</span>
              <span>Origin:</span>
              <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{finding.origin}</span>
            </div>
          </div>

          {/* Location & Coordinates */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm) var(--space-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              flexWrap: 'wrap',
              gap: 'var(--space-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <FileCode size={14} color="var(--color-accent-primary)" />
              <span style={{ color: 'var(--color-text-primary)' }}>{finding.file}</span>
            </div>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {finding.lineRange || finding.line_range || 'File coordinates not available'}
            </span>
          </div>

          {/* Summary & Detailed Explanation */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Measured Finding Summary
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: '1.5', marginBottom: 'var(--space-xs)' }}>
              {finding.summary}
            </p>
            {finding.detailedExplanation && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                {finding.detailedExplanation}
              </p>
            )}
          </div>

          {/* Evidence Block */}
          {finding.evidence && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-primary)' }}>
                  Verified AST Evidence
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {finding.evidence.type || 'STATIC_AST'}
                </span>
              </div>

              {(finding.evidence.codeSnippet || finding.evidence.code_snippet) && (
                <div
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-sm) var(--space-md)',
                    overflowX: 'auto',
                  }}
                >
                  <pre
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      color: '#E0EAE3',
                      lineHeight: '1.4',
                      margin: 0,
                    }}
                  >
                    <code>{finding.evidence.codeSnippet || finding.evidence.code_snippet}</code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Maintainability Impact (Why This Matters) */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Maintainability Impact (Why This Matters)
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              {finding.maintainabilityImpact || finding.maintainability_impact || finding.whyItMatters}
            </p>
          </div>

          {/* Recommended Remediation (Static Rule Guidance) */}
          <div
            style={{
              backgroundColor: 'rgba(0, 245, 160, 0.05)',
              border: '1px solid rgba(0, 245, 160, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-primary)' }}>
                Rule Recommended Remediation
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: '1.5', margin: 0 }}>
              {finding.recommendedRemediation || finding.recommended_remediation || finding.recommendedAction}
            </p>
          </div>

          {/* Related Findings when available */}
          {finding.relatedFindingIds && finding.relatedFindingIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-xs)' }}>
              <LinkIcon size={12} color="var(--color-text-muted)" />
              <span style={{ color: 'var(--color-text-muted)' }}>Related Findings:</span>
              {finding.relatedFindingIds.map((relId) => (
                <button
                  key={relId}
                  onClick={() => onSelectRelatedFinding && onSelectRelatedFinding(relId)}
                  style={{
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 6px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-accent-primary)',
                    cursor: onSelectRelatedFinding ? 'pointer' : 'default',
                    fontSize: '11px',
                  }}
                  title="Click to inspect related finding"
                >
                  {relId}
                </button>
              ))}
            </div>
          )}

          {/* ======================================================== */}
          {/* GEMINI AI EXPLANATION & REFACTORING SECTION (Phase 13) */}
          {/* ======================================================== */}

          {/* Case 1: Explanation Loaded Successfully */}
          {explanation && (
            <div
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.06)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
              }}
            >
              {/* Header with clear provenance */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                  {explanation.origin === 'FALLBACK_RULE_BASED' ? (
                    <Badge variant="demo" style={{ background: 'rgba(85, 199, 232, 0.15)', borderColor: '#55C7E8', color: '#BAE6FD' }}>
                      <Sparkles size={11} />
                      <span>RULE-BASED DETERMINISTIC EXPLANATION</span>
                    </Badge>
                  ) : (
                    <Badge variant="demo" style={{ background: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7', color: '#E9D5FF' }}>
                      <Sparkles size={11} />
                      <span>AI EXPLANATION (GEMINI: {explanation.modelName || 'gemini-3.8-flash'})</span>
                    </Badge>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {explanation.origin === 'FALLBACK_RULE_BASED' ? 'Generated from verified static rule templates (Gemini offline)' : 'Generated advisory guidance'}
                  </span>
                </div>

                <Button
                  variant="outline"
                  onClick={() => handleRequestExplanation(explanation.origin === 'FALLBACK_RULE_BASED')}
                  disabled={isExplaining}
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                  icon={<RefreshCw size={11} className={isExplaining ? 'spinning-icon' : ''} />}
                >
                  Regenerate
                </Button>
              </div>

              {/* 1. Plain-Language Explanation */}
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#D8B4FE', display: 'block', marginBottom: '4px' }}>
                  Plain-Language Summary
                </span>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: '1.6', margin: 0 }}>
                  {explanation.plainLanguageExplanation}
                </p>
                {explanation.priorityGuidance && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-xs)', marginTop: '8px' }}>
                    <span style={{ color: '#D8B4FE', fontWeight: 'var(--font-semibold)' }}>Triage Priority:</span>
                    <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{explanation.priorityGuidance}</span>
                  </div>
                )}
              </div>

              {/* 2. Deep Maintainability Reasoning */}
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#D8B4FE', display: 'block', marginBottom: '4px' }}>
                  Maintainability &amp; Risk Impact
                </span>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: '1.5', margin: 0 }}>
                  {explanation.whyItMatters}
                </p>
              </div>

              {/* 3. Proposed Remediation Strategy */}
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-primary)', display: 'block', marginBottom: '4px' }}>
                  Proposed Remediation Strategy
                </span>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', lineHeight: '1.5', margin: 0 }}>
                  {explanation.proposedRemediation}
                </p>
              </div>

              {/* 4. Suggested Refactoring Example (if provided) */}
              {explanation.refactoringExample && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent-primary)' }}>
                        Suggested Refactoring Example
                      </span>
                      {explanation.isExampleIllustrative && (
                        <span style={{ fontSize: '10px', background: 'rgba(0, 245, 160, 0.1)', color: 'var(--color-accent-primary)', border: '1px solid rgba(0, 245, 160, 0.25)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                          Illustrative Pattern (Not Applied)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyRefactoring}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedSnippet ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {copiedSnippet ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedSnippet ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-sm) var(--space-md)',
                      overflowX: 'auto',
                    }}
                  >
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: '#A7F3D0',
                        lineHeight: '1.45',
                        margin: 0,
                      }}
                    >
                      <code>{explanation.refactoringExample}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* 5. Trade-offs & Nuances */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm) var(--space-md)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-severity-medium)', display: 'block', marginBottom: '2px' }}>
                    Potential Trade-offs &amp; Risks:
                  </span>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4', margin: 0 }}>
                    {explanation.potentialTradeoffs}
                  </p>
                </div>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm) var(--space-md)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: 'var(--color-severity-info)', display: 'block', marginBottom: '2px' }}>
                    Architectural Considerations:
                  </span>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4', margin: 0 }}>
                    {explanation.architecturalConsiderations}
                  </p>
                </div>
              </div>

              {/* 6. Context Limitations Notice (Honest Disclosure) */}
              {explanation.contextLimitations && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: 'var(--color-severity-info)', background: 'rgba(85, 199, 232, 0.08)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span><strong>Context Limitation:</strong> {explanation.contextLimitations}</span>
                </div>
              )}

              {/* Explicit Disclaimer */}
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(168, 85, 247, 0.2)', paddingTop: '6px' }}>
                <span>• AI-generated guidance is advisory. Ground truth measurements remain determined by the CodeSentinel static engine.</span>
              </div>
            </div>
          )}

          {/* Case 2: Loading State */}
          {isExplaining && (
            <div
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
              }}
            >
              <RefreshCw size={20} className="spinning-icon" color="#A855F7" />
              <div>
                <strong style={{ color: '#E9D5FF', fontSize: 'var(--text-sm)' }}>
                  Consulting Gemini AI Explanation Engine...
                </strong>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0, marginTop: '2px' }}>
                  Synthesizing plain-language analysis, maintainability trade-offs, and safe refactoring guidance.
                </p>
              </div>
            </div>
          )}

          {/* Case 3: Error Occurred */}
          {explanationError && !isExplaining && (
            <div
              style={{
                backgroundColor: 'rgba(255, 93, 104, 0.1)',
                border: '1px solid var(--color-severity-critical)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-md)',
              }}
            >
              <AlertCircle size={18} color="var(--color-severity-critical)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--color-severity-critical)', fontSize: 'var(--text-xs)', display: 'block', marginBottom: '2px' }}>
                  AI Explanation Unavailable
                </strong>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', margin: 0, marginBottom: 'var(--space-xs)' }}>
                  {explanationError}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    onClick={() => handleRequestExplanation(false)}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    icon={<RotateCcw size={11} />}
                  >
                    Retry Gemini
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleRequestExplanation(true)}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    icon={<Sparkles size={11} />}
                  >
                    Use Rule-Based Fallback
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setExplanationError(null)}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Case 4: Initial Prompt / Call-to-Action (When not yet requested) */}
          {!explanation && !isExplaining && !explanationError && (
            <div
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.05)',
                border: '1px dashed rgba(168, 85, 247, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-xs)', color: '#D8B4FE' }}>
                <Bot size={16} />
                <span>Need deeper technical context? Request AI remediation guidance.</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  onClick={() => handleRequestExplanation(true)}
                  style={{ fontSize: 'var(--text-xs)' }}
                  title="Generate instant deterministic explanation from static rule templates"
                >
                  Rule-Based Guidance
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleRequestExplanation(false)}
                  style={{
                    fontSize: 'var(--text-xs)',
                    background: 'linear-gradient(135deg, #A855F7 0%, #00F5A0 100%)',
                    color: '#080B0A',
                    fontWeight: 'var(--font-semibold)',
                    border: 'none',
                  }}
                  icon={<Sparkles size={13} />}
                >
                  Explain with AI (Gemini)
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default FindingDetailModal;
