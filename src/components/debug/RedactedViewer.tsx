"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { redactObject, redactJson, REDACTED_PLACEHOLDER } from "@/lib/redaction";

interface RedactedViewerProps {
  /** The payload to display — either a string or a plain object/array. */
  payload: string | object | null | undefined;
  /** Optional CSS class names for the outer wrapper. */
  className?: string;
  /** Label shown above the viewer (for accessibility). */
  label?: string;
}

/**
 * RedactedViewer
 *
 * Displays a debug payload with sensitive fields masked by default.
 * Users can copy the sanitized payload for support workflows.
 */
export function RedactedViewer({ payload, className, label = "Debug payload" }: RedactedViewerProps) {
  const [copied, setCopied] = useState(false);

  const sanitized =
    payload == null
      ? ""
      : typeof payload === "string"
      ? redactJson(payload)
      : JSON.stringify(redactObject(payload), null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(sanitized).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={cn("rounded-md border border-border bg-muted/50 text-sm", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-muted-foreground"
            title={`Fields matching sensitive patterns are replaced with "${REDACTED_PLACEHOLDER}"`}
          >
            secrets masked
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
            aria-label="Copy sanitized payload"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <pre
        className="overflow-auto p-3 text-xs leading-relaxed whitespace-pre-wrap break-words max-h-96"
        role="region"
        aria-label={label}
      >
        {sanitized || <span className="text-muted-foreground italic">No payload</span>}
      </pre>
    </div>
  );
}
