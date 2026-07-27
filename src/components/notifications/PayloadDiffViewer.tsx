"use client";

import { useMemo, useState } from "react";
import { diffLines } from "diff";

interface PayloadDiffViewerProps {
  originalPayload: unknown;
  retryPayload: unknown;
}

function formatPayload(
  payload: unknown,
): string {
  try {
    return JSON.stringify(
      payload,
      null,
      2,
    );
  } catch {
    return String(payload);
  }
}

export function PayloadDiffViewer({
  originalPayload,
  retryPayload,
}: PayloadDiffViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const changes = useMemo(() => {
    const original = formatPayload(
      originalPayload,
    );

    const retry = formatPayload(
      retryPayload,
    );

    return diffLines(
      original,
      retry,
    );
  }, [
    originalPayload,
    retryPayload,
  ]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Show Diff
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
        >
          <div>
            <h2>Webhook Payload Diff</h2>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>

          <pre>
            {changes.map(
              (change, index) => (
                <div
                  key={`${index}-${change.value}`}
                >
                  {change.added && "+ "}
                  {change.removed && "- "}
                  {!change.added &&
                    !change.removed &&
                    "  "}
                  {change.value}
                </div>
              ),
            )}
          </pre>
        </div>
      )}
    </div>
  );
}