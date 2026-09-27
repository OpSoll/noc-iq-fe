'use client';

import { useState } from 'react';

import Modal from '@/components/ui/modal';
import {
  formatExample,
  formatSchema,
  getEventDefinition,
  WEBHOOK_EVENTS,
  type WebhookEventDefinition,
} from '@/lib/webhookEvents';
import { cn } from '@/lib/utils';

/**
 * In-dashboard reference for the payload shape of every webhook event.
 *
 * Receiver authors otherwise have to read the platform source or ask in chat
 * to learn what a payload contains. Each tab shows the JSON Schema and a
 * realistic example, both copyable.
 *
 * Closes #670 — webhook payload JSON schema viewer modal.
 */

export interface SchemaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selects a topic tab; defaults to the first. */
  initialTopic?: string;
  className?: string;
}

export default function SchemaViewerModal({
  isOpen,
  onClose,
  initialTopic,
  className,
}: SchemaViewerModalProps) {
  const requested = initialTopic ? getEventDefinition(initialTopic) : null;
  const [activeTopic, setActiveTopic] = useState(
    requested?.topic ?? WEBHOOK_EVENTS[0].topic
  );
  const [copied, setCopied] = useState<'schema' | 'example' | null>(null);

  const active: WebhookEventDefinition =
    getEventDefinition(activeTopic) ?? WEBHOOK_EVENTS[0];

  const copy = async (
    kind: 'schema' | 'example',
    text: string
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="View Event Schemas"
      maxWidth="max-w-3xl"
    >
      <div className={cn('space-y-3', className)}>
        <p className="text-sm text-slate-600">
          JSON Schema and example payload for every supported webhook event.
        </p>

        <div
          role="tablist"
          aria-label="Webhook event types"
          className="flex flex-wrap gap-1 border-b border-slate-200 pb-2"
        >
          {WEBHOOK_EVENTS.map((event) => (
            <button
              key={event.topic}
              type="button"
              role="tab"
              aria-selected={event.topic === active.topic}
              onClick={() => {
                setActiveTopic(event.topic);
                setCopied(null);
              }}
              data-testid={`schema-tab-${event.topic}`}
              className={cn(
                'rounded-md px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                event.topic === active.topic
                  ? 'bg-indigo-50 font-semibold text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {event.topic}
            </button>
          ))}
        </div>

        <p
          data-testid="schema-active-description"
          className="text-xs text-slate-500"
        >
          {active.description}
        </p>

        <CodeBlock
          title="JSON Schema"
          testId="schema-json"
          code={formatSchema(active.schema)}
          onCopy={() => void copy('schema', formatSchema(active.schema))}
          copied={copied === 'schema'}
          copyLabel="Copy JSON Schema"
        />

        <CodeBlock
          title="Example payload"
          testId="schema-example"
          code={formatExample(active.example)}
          onCopy={() => void copy('example', formatExample(active.example))}
          copied={copied === 'example'}
          copyLabel="Copy example payload"
        />
      </div>
    </Modal>
  );
}

function CodeBlock({
  title,
  testId,
  code,
  onCopy,
  copied,
  copyLabel,
}: {
  title: string;
  testId: string;
  code: string;
  onCopy: () => void;
  copied: boolean;
  copyLabel: string;
}) {
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        <button
          type="button"
          onClick={onCopy}
          data-testid={`${testId}-copy`}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {copied ? 'Copied' : copyLabel}
        </button>
      </div>
      <pre
        data-testid={testId}
        className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100"
      >
        {code}
      </pre>
    </section>
  );
}
