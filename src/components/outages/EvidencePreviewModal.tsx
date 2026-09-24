"use client";

/**
 * Evidence document previewer (opsoll/noc-iq-fe#495).
 *
 * In-app preview for dispute evidence attachments (PDF and images) with
 * zoom/rotation controls and a direct download fallback, so reviewers no
 * longer need to download files locally just to inspect them.
 */

import { useState } from "react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { DisputeAttachment } from "@/types/sla";

interface EvidencePreviewModalProps {
  /** Attachment currently being previewed; null closes the modal. */
  attachment: DisputeAttachment | null;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const ROTATE_STEP = 90;

export default function EvidencePreviewModal({
  attachment,
  onClose,
}: EvidencePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!attachment) return null;

  const isPdf = attachment.content_type === "application/pdf";
  const isImage = attachment.content_type.startsWith("image/");

  return (
    <Modal
      isOpen={Boolean(attachment)}
      onClose={onClose}
      title={`Evidence: ${attachment.filename}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3">
        {/* Zoom / rotation controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
              }
              aria-label="Zoom out"
              disabled={zoom <= MIN_ZOOM}
            >
              −
            </Button>
            <span
              className="min-w-[3.5rem] text-center text-xs text-slate-500"
              aria-live="polite"
            >
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
              }
              aria-label="Zoom in"
              disabled={zoom >= MAX_ZOOM}
            >
              +
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRotation((r) => (r + ROTATE_STEP) % 360)}
              aria-label="Rotate 90 degrees"
            >
              Rotate {rotation}°
            </Button>

            {/* Direct download fallback — always available. */}
            <a
              href={attachment.url}
              download={attachment.filename}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="outline">
                Download
              </Button>
            </a>
          </div>
        </div>

        {/* Preview surface */}
        <div className="max-h-[65vh] min-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50">
          {isImage ? (
            <img
              src={attachment.url}
              alt={attachment.filename}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                maxWidth: "100%",
                height: "auto",
              }}
              className="mx-auto block p-4"
            />
          ) : isPdf ? (
            <object
              data={attachment.url}
              type="application/pdf"
              width="100%"
              height={Math.round(420 * zoom)}
              className="p-2"
            >
              <div className="p-6 text-center text-sm text-slate-600">
                Inline PDF preview is unavailable in this browser.
                <div className="mt-2">
                  <a
                    href={attachment.url}
                    download={attachment.filename}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    Download {attachment.filename}
                  </a>
                </div>
              </div>
            </object>
          ) : (
            <div className="p-6 text-center text-sm text-slate-600">
              This file type ({" "}
              <span className="font-mono">{attachment.content_type}</span>){" "}
              cannot be previewed in-browser.
              <div className="mt-2">
                <a
                  href={attachment.url}
                  download={attachment.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Download {attachment.filename}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
