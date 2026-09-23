"use client";

import { useState } from "react";

import type { Webhook } from "@/types/webhook";

interface Props {
  webhook: Webhook;
  isRotating: boolean;
  onRotate: (graceHours: number) => void;
  onClose: () => void;
}

const DEFAULT_GRACE_HOURS = 24;

/**
 * Confirms and configures a webhook signing-secret rotation. Both the
 * active and (once rotated) secondary secret are shown as masked previews
 * only — the full secret value is never exposed here.
 */
export function RotateSecretModal({
  webhook,
  isRotating,
  onRotate,
  onClose,
}: Props) {
  const [graceHours, setGraceHours] = useState(DEFAULT_GRACE_HOURS);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Rotate signing secret</h3>
      <p className="text-xs text-gray-500">
        Generates a new signing secret. The current secret keeps working
        alongside the new one for the grace window below, so existing
        receivers aren&apos;t broken mid-rotation.
      </p>

      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-600">Active secret</p>
        <code className="block rounded border bg-white px-2 py-1 text-xs text-gray-700">
          {webhook.secret_preview ?? "whsec_••••••••"}
        </code>
      </div>

      {webhook.secondary_secret_preview && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">
            Secondary secret{" "}
            {webhook.secondary_secret_expires_at && (
              <span className="font-normal text-gray-400">
                (expires{" "}
                {new Date(webhook.secondary_secret_expires_at).toLocaleString()})
              </span>
            )}
          </p>
          <code className="block rounded border bg-white px-2 py-1 text-xs text-gray-700">
            {webhook.secondary_secret_preview}
          </code>
        </div>
      )}

      <label className="block text-xs font-medium text-gray-600">
        Grace period (hours)
        <input
          type="number"
          min={1}
          max={168}
          value={graceHours}
          onChange={(e) => setGraceHours(Number(e.target.value))}
          className="mt-1 block w-24 rounded border px-2 py-1 text-sm"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onRotate(graceHours)}
          disabled={isRotating || graceHours <= 0}
          className="rounded border border-amber-400 bg-amber-400 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40"
        >
          {isRotating ? "Rotating…" : "Rotate secret"}
        </button>
      </div>
    </div>
  );
}
