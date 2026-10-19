'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RouteErrorState,
  RouteLoadingState,
} from '@/components/ui/route-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Settings } from 'lucide-react';
import { api } from '@/lib/api';
import {
  getBoundsHint,
  SLA_BOUNDS,
  validateSlaConfig,
  type SlaBoundKey,
} from '@/lib/slaBounds';

type Severity = 'critical' | 'high' | 'medium' | 'low';

type SLASeverityConfig = {
  threshold_minutes: number;
  penalty_per_minute: number;
  reward_base: number;
};

type SLAConfigMap = Record<string, SLASeverityConfig>;

type EditableConfig = SLASeverityConfig & {
  severity: Severity;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred';
}

function getSeverityVariant(severity: Severity) {
  if (severity === 'critical' || severity === 'high') {
    return 'destructive';
  }
  return 'default';
}

/**
 * A bounded number input for an SLA field (#989): bound-derived `min`/`step`
 * attributes, helper text describing the accepted range and an inline error when
 * the value falls outside it.
 */
function SlaNumberField({
  id,
  field,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  field: SlaBoundKey;
  label: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  const spec = SLA_BOUNDS[field];
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-400' : ''
        }`}
      />
      <p id={hintId} className="mt-1 text-xs text-muted-foreground">
        {getBoundsHint(field)}
      </p>
      {error ? (
        <p
          id={errorId}
          role="alert"
          data-testid={`${id}-error`}
          className="mt-1 text-xs text-red-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function SlaConfigPage() {
  const [configs, setConfigs] = useState<EditableConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<EditableConfig | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SLASeverityConfig>({
    threshold_minutes: 0,
    penalty_per_minute: 0,
    reward_base: 0,
  });

  // #989: inline errors for out-of-range values, shown per field.
  const boundErrors = validateSlaConfig(formData);

  useEffect(() => {
    void fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<SLAConfigMap>('/sla/config');
      const nextConfigs = Object.entries(response.data)
        .map(([severity, config]) => ({
          severity: severity as Severity,
          ...config,
        }))
        .sort((left, right) => {
          const order: Record<Severity, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
          };
          return order[left.severity] - order[right.severity];
        });
      setConfigs(nextConfigs);
    } catch (issue) {
      setError(getErrorMessage(issue));
    } finally {
      setLoading(false);
    }
  }

  function handleEditClick(config: EditableConfig) {
    setEditingConfig(config);
    setFormData({
      threshold_minutes: config.threshold_minutes,
      penalty_per_minute: config.penalty_per_minute,
      reward_base: config.reward_base,
    });
    setSaveError(null);
  }

  function handleCancel() {
    if (editingConfig) {
      const isDirty =
        formData.threshold_minutes !== editingConfig.threshold_minutes ||
        formData.penalty_per_minute !== editingConfig.penalty_per_minute ||
        formData.reward_base !== editingConfig.reward_base;

      if (
        isDirty &&
        !window.confirm(
          'You have unsaved changes. Are you sure you want to discard them?'
        )
      ) {
        return;
      }
    }
    setEditingConfig(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!editingConfig) {
      return;
    }

    // #989: reject out-of-range values with a per-field message.
    const boundErrors = validateSlaConfig(formData);
    const firstError = Object.values(boundErrors)[0];
    if (firstError) {
      setSaveError(firstError);
      return;
    }

    if (
      formData.threshold_minutes < 0 ||
      formData.penalty_per_minute < 0 ||
      formData.reward_base < 0
    ) {
      setSaveError('Values cannot be negative.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await api.put<SLASeverityConfig>(
        `/sla/config/${editingConfig.severity}`,
        formData
      );

      setConfigs((currentConfigs) =>
        currentConfigs.map((config) =>
          config.severity === editingConfig.severity
            ? { severity: editingConfig.severity, ...response.data }
            : config
        )
      );
      setEditingConfig(null);
    } catch (issue) {
      setSaveError(getErrorMessage(issue));
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <RouteLoadingState
        title="Loading SLA configuration"
        description="Fetching the latest severity thresholds and payout settings."
      />
    );
  }

  if (error) {
    return (
      <RouteErrorState
        title="Configuration unavailable"
        description={error}
        primaryAction={{
          label: 'Try again',
          onClick: () => void fetchConfigs(),
        }}
      />
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        SLA Configuration Management
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Severity Service Level Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="border-b p-3 font-medium">Severity</th>
                  <th className="border-b p-3 font-medium">Threshold (mins)</th>
                  <th className="border-b p-3 font-medium">Reward Base</th>
                  <th className="border-b p-3 font-medium">Penalty / Minute</th>
                  <th className="border-b p-3 text-right font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => (
                  <tr
                    key={config.severity}
                    className="border-b transition-colors hover:bg-muted/30"
                  >
                    <td className="p-3 capitalize">
                      <Badge variant={getSeverityVariant(config.severity)}>
                        {config.severity}
                      </Badge>
                    </td>
                    <td className="p-3">{config.threshold_minutes}</td>
                    <td className="p-3 font-medium text-emerald-600">
                      {config.reward_base}
                    </td>
                    <td className="p-3 font-medium text-red-600">
                      {config.penalty_per_minute}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleEditClick(config)}
                        className="rounded px-2 py-1 font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {configs.length === 0 ? (
              <EmptyState
                icon={Settings}
                title="No configurations found"
                description="SLA configurations will appear here once they are created."
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {editingConfig ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-bold capitalize">
              Edit {editingConfig.severity} SLA
            </h2>

            {saveError ? (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {saveError}
              </div>
            ) : null}

            <div className="space-y-4">
              <SlaNumberField
                id="sla-threshold-minutes"
                field="threshold_minutes"
                label="Threshold (minutes)"
                value={formData.threshold_minutes}
                error={boundErrors.threshold_minutes}
                onChange={(value) =>
                  setFormData((current) => ({
                    ...current,
                    threshold_minutes: value,
                  }))
                }
              />
              <SlaNumberField
                id="sla-reward-base"
                field="reward_base"
                label="Reward Base"
                value={formData.reward_base}
                error={boundErrors.reward_base}
                onChange={(value) =>
                  setFormData((current) => ({
                    ...current,
                    reward_base: value,
                  }))
                }
              />
              <SlaNumberField
                id="sla-penalty-per-minute"
                field="penalty_per_minute"
                label="Penalty Per Minute"
                value={formData.penalty_per_minute}
                error={boundErrors.penalty_per_minute}
                onChange={(value) =>
                  setFormData((current) => ({
                    ...current,
                    penalty_per_minute: value,
                  }))
                }
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
