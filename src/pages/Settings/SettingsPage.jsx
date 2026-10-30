import React, { useState } from 'react';
import { Settings, Save, Check } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Input,
  Button,
  Badge,
} from '../../ui';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function SettingsPage() {
  useDocumentTitle('Settings');
  const [complexityThreshold, setComplexityThreshold] = useState('15');
  const [duplicationLines, setDuplicationLines] = useState('30');
  const [couplingThreshold, setCouplingThreshold] = useState('12');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div>
      <PageHeader
        title="Settings & Thresholds"
        icon={<Settings size={24} />}
        description="Fine-tune technical debt thresholds, static analysis severity cutoffs, and quality gate boundaries."
        actions={
          <Badge variant="demo">CONFIG DEFAULTS</Badge>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-lg)' }}>
        <Card>
          <CardHeader
            title="Analysis Sensitivity Thresholds"
            subtitle="Configure what constitutes an actionable violation"
          />
          <CardBody>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <Input
                label="Cyclomatic Complexity Threshold (McCabe)"
                type="number"
                value={complexityThreshold}
                onChange={(e) => setComplexityThreshold(e.target.value)}
                hint="Functions scoring above this limit are flagged as maintainability risks (standard default: 15)."
              />

              <Input
                label="Minimum Duplication Block Size (Lines)"
                type="number"
                value={duplicationLines}
                onChange={(e) => setDuplicationLines(e.target.value)}
                hint="Identical or near-identical syntax blocks longer than this will trigger a duplication finding."
              />

              <Input
                label="Architectural In-Degree Coupling Warning"
                type="number"
                value={couplingThreshold}
                onChange={(e) => setCouplingThreshold(e.target.value)}
                hint="Modules imported by more than this number of dependents trigger a god-object blast radius warning."
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                <Button type="submit" variant="primary" icon={<Save size={15} />}>
                  Save Configuration
                </Button>
                {isSaved && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Saved locally
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card elevated>
          <CardHeader
            title="Analysis Engine Provenance"
            subtitle="Mode configuration and diagnostic telemetry"
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              <div>
                <strong>Active Mode:</strong>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant="demo">DEMONSTRATION MODE</Badge>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Runs deterministic offline sample data with zero backend dependencies.
                </p>
              </div>

              <div>
                <strong>Static Analysis Engine:</strong>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Python AST + Radon + Custom Duplication Analyzer (scheduled for FastAPI backend in Phase 7).
                </p>
              </div>

              <div>
                <strong>AI Remediation Engine:</strong>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Google Gemini 2.5/Flash called exclusively via secure backend endpoints in Phase 7.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
