'use client';

import { useEffect, useId, useState } from 'react';

import Modal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  generateWebhookSecret,
  maskSecret,
  validateWebhookForm,
  WEBHOOK_TOPICS,
  type WebhookFieldErrors,
  type WebhookFormValues,
} from '@/lib/webhookForm';

/**
 * Registration form for a new outbound webhook endpoint.
 *
 * Replaces the need to hand-craft a raw `POST /webhooks` request: it validates
 * the target URL (forcing HTTPS in production, rejecting internal hosts),
 * collects the topic subscriptions as checkboxes, and generates a signing
 * secret when the operator leaves the field blank.
 *
 * Closes #663 — webhook endpoint registration modal component.
 */

export interface CreateWebhookPayload {
  url: string;
  description: string;
  secret: string;
  events: string[];
}

export interface CreateWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Performs the registration; the modal owns validation, not transport. */
  onCreate: (payload: CreateWebhookPayload) => Promise<void> | void;
  /** Forces HTTPS regardless of NODE_ENV, for staging environments. */
  requireHttps?: boolean;
}

const EMPTY: WebhookFormValues = {
  url: '',
  description: '',
  secret: '',
  topics: [],
};

export default function CreateWebhookModal({
  isOpen,
  onClose,
  onCreate,
  requireHttps,
}: CreateWebhookModalProps) {
  const toast = useToast();
  const id = useId();

  const [values, setValues] = useState<WebhookFormValues>(EMPTY);
  const [errors, setErrors] = useState<WebhookFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  // Never leave a previous attempt's data behind when the modal reopens.
  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY);
      setErrors({});
      setSubmitted(false);
      setIsSaving(false);
      setGeneratedSecret(null);
    }
  }, [isOpen]);

  const setField = <K extends keyof WebhookFormValues>(
    key: K,
    value: WebhookFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors(validateWebhookForm({ ...values, [key]: value }, { requireHttps }));
    }
  };

  const toggleTopic = (topic: string) => {
    const next = values.topics.includes(topic)
      ? values.topics.filter((t) => t !== topic)
      : [...values.topics, topic];
    setField('topics', next);
  };

  const handleGenerateSecret = () => {
    const secret = generateWebhookSecret();
    setGeneratedSecret(secret);
    setField('secret', secret);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);

    const found = validateWebhookForm(values, { requireHttps });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSaving(true);
    try {
      await onCreate({
        url: values.url.trim(),
        description: values.description.trim(),
        // A blank field means "generate one for me".
        secret: values.secret.trim() || generateWebhookSecret(),
        events: values.topics,
      });
      toast('Webhook endpoint registered', 'success');
      onClose();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Could not register the endpoint',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register webhook endpoint"
      maxWidth="max-w-xl"
      disableBackdropClose
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label
            htmlFor={`${id}-url`}
            className="block text-sm font-medium text-slate-700"
          >
            Target URL
          </label>
          <input
            id={`${id}-url`}
            type="url"
            value={values.url}
            onChange={(e) => setField('url', e.target.value)}
            onBlur={() =>
              setErrors(validateWebhookForm(values, { requireHttps }))
            }
            placeholder="https://example.com/hooks/noc"
            aria-invalid={Boolean(errors.url)}
            aria-describedby={errors.url ? `${id}-url-error` : undefined}
            data-testid="webhook-url-input"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          {errors.url && (
            <p
              id={`${id}-url-error`}
              role="alert"
              data-testid="webhook-url-error"
              className="text-xs text-red-700"
            >
              {errors.url}
            </p>
          )}
          <p className="text-xs text-slate-500">
            HTTPS is required in production so payloads and signatures are not
            sent in clear text.
          </p>
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${id}-description`}
            className="block text-sm font-medium text-slate-700"
          >
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id={`${id}-description`}
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Primary ops alerting receiver"
            data-testid="webhook-description-input"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={`${id}-secret`}
            className="block text-sm font-medium text-slate-700"
          >
            Signing secret{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-secret`}
              value={values.secret}
              onChange={(e) => {
                setGeneratedSecret(null);
                setField('secret', e.target.value);
              }}
              placeholder="Leave blank to generate one"
              aria-invalid={Boolean(errors.secret)}
              aria-describedby={
                errors.secret ? `${id}-secret-error` : undefined
              }
              data-testid="webhook-secret-input"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleGenerateSecret}
              data-testid="webhook-generate-secret"
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Generate
            </button>
          </div>
          {errors.secret && (
            <p
              id={`${id}-secret-error`}
              role="alert"
              data-testid="webhook-secret-error"
              className="text-xs text-red-700"
            >
              {errors.secret}
            </p>
          )}
          {generatedSecret && (
            <p className="text-xs text-emerald-700">
              Generated secret:{' '}
              <code data-testid="webhook-generated-secret" className="font-mono">
                {maskSecret(generatedSecret)}
              </code>{' '}
              — copy it now, it is not shown again.
            </p>
          )}
        </div>

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-slate-700">
            Event topics
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {WEBHOOK_TOPICS.map((topic) => (
              <label
                key={topic.value}
                className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={values.topics.includes(topic.value)}
                  onChange={() => toggleTopic(topic.value)}
                  data-testid={`webhook-topic-${topic.value}`}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {topic.label}
                <span className="font-mono text-xs text-slate-400">
                  {topic.value}
                </span>
              </label>
            ))}
          </div>
          {errors.topics && (
            <p
              role="alert"
              data-testid="webhook-topics-error"
              className="text-xs text-red-700"
            >
              {errors.topics}
            </p>
          )}
        </fieldset>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            data-testid="webhook-submit"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            {isSaving ? 'Registering…' : 'Register endpoint'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
