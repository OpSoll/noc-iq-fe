'use client';

import { explainTxError } from '@/lib/txErrors';

/**
 * Renders a transaction simulation failure as plain-language guidance.
 *
 * Pre-flight simulation failures otherwise reach the operator as a raw code
 * such as `HostError: Error(Contract, #1)`. This translates the recognised
 * codes, states the concrete remedy, and links to the relevant protocol
 * documentation while keeping the original text visible for lookup.
 *
 * Closes #661 — transaction simulation error explainer component.
 */

export interface TxErrorExplainerProps {
  /** Raw error text from the wallet or simulation response. */
  error: string | null | undefined;
  className?: string;
  /** Renders a compact variant for use inside a toast or inline banner. */
  compact?: boolean;
}

export default function TxErrorExplainer({
  error,
  className,
  compact = false,
}: TxErrorExplainerProps) {
  const explanation = explainTxError(error);
  const isUnknown = explanation.code === 'unknown';
  const raw = (error ?? '').trim();

  return (
    <section
      data-testid="tx-error-explainer"
      data-code={explanation.code ?? 'unknown'}
      role="alert"
      aria-labelledby="tx-error-title"
      className={[
        'rounded-lg border p-4',
        isUnknown
          ? 'border-slate-300 bg-slate-50 text-slate-800'
          : 'border-red-200 bg-red-50 text-red-900',
        compact ? 'space-y-2 p-3 text-xs' : 'space-y-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div>
        <h3
          id="tx-error-title"
          className={compact ? 'text-sm font-semibold' : 'text-base font-semibold'}
        >
          {explanation.title}
        </h3>
        {!compact && (
          <p className="mt-1 text-sm">{explanation.description}</p>
        )}
      </div>

      <div
        className={
          compact ? 'space-y-1' : 'rounded-md border border-red-200 bg-white p-3'
        }
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          What to do
        </p>
        <p className={compact ? '' : 'mt-1 text-sm'}>{explanation.remedy}</p>
      </div>

      <a
        href={explanation.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-medium underline underline-offset-2 hover:no-underline"
      >
        {explanation.docsLabel} ↗
      </a>

      {raw && !compact && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Raw error</summary>
          <pre
            data-testid="tx-error-raw"
            className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono"
          >
            {raw}
          </pre>
        </details>
      )}
    </section>
  );
}
