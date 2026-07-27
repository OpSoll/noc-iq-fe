"use client";

import { useMemo, useState } from "react";

interface PayloadViewerProps {
  payload: unknown;
}

export function PayloadViewer({
  payload,
}: PayloadViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formattedPayload = useMemo(() => {
    try {
      return JSON.stringify(
        payload,
        null,
        2,
      );
    } catch {
      return String(payload);
    }
  }, [payload]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
      >
        View Payload
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
        >
          <div>
            <h2>Webhook Payload</h2>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>

          <pre>
            <code>{formattedPayload}</code>
          </pre>
        </div>
      )}
    </div>
  );
}