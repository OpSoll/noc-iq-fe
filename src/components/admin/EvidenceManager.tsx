"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileCode2,
  FileImage,
  FileText,
  Paperclip,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DisputeEvidence } from "@/types/sla";

/** Broad classification of an evidence file, derived from its MIME type. */
export type EvidenceKind = "image" | "pdf" | "json" | "text" | "other";

/**
 * Classifies an evidence file.
 *
 * Driven by MIME type rather than the filename extension, because the extension is
 * user-supplied and the server's content type is what a browser will actually
 * honour when the file is opened.
 *
 * @param contentType - MIME type from the server.
 * @returns The kind used to pick an icon and decide previewability.
 */
export function evidenceKind(contentType: string): EvidenceKind {
  const type = contentType.toLowerCase();

  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (type === "application/json" || type.endsWith("+json")) return "json";
  if (type.startsWith("text/")) return "text";
  return "other";
}

/**
 * Whether a file can be shown in a preview pane.
 *
 * Only images and PDFs are previewable. JSON and text would need their contents
 * fetched and, without a documented endpoint or a same-origin guarantee, an
 * embedded fetch of an arbitrary evidence URL is the kind of thing that fails
 * silently in production. Those download instead, which is the behaviour the issue
 * allows for.
 *
 * @param kind - Result of {@link evidenceKind}.
 * @returns True when a preview can be rendered.
 */
export function isPreviewable(kind: EvidenceKind): boolean {
  return kind === "image" || kind === "pdf";
}

function KindIcon({ kind }: { kind: EvidenceKind }) {
  const className = "h-5 w-5 text-muted-foreground";

  if (kind === "image") return <FileImage className={className} aria-hidden="true" />;
  if (kind === "json") return <FileCode2 className={className} aria-hidden="true" />;
  if (kind === "pdf" || kind === "text")
    return <FileText className={className} aria-hidden="true" />;
  return <Paperclip className={className} aria-hidden="true" />;
}

const KIND_LABEL: Record<EvidenceKind, string> = {
  image: "Image",
  pdf: "PDF",
  json: "JSON",
  text: "Text",
  other: "File",
};

function formatSize(bytes?: number): string | null {
  if (bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface EvidenceManagerProps {
  /** Files attached to the dispute. */
  evidence: DisputeEvidence[];
  /**
   * Whether the dispute still accepts evidence. Upload is hidden when false —
   * attaching to a closed dispute would imply it will be considered.
   */
  isActive?: boolean;
  /** Receives files chosen for upload. Required to show the upload control. */
  onAddEvidence?: (files: File[]) => void | Promise<void>;
  /** Overridable so a test does not need to drive a real download. */
  onDownload?: (item: DisputeEvidence) => void;
  className?: string;
}

/**
 * Arbitration evidence attachment manager (issue #640).
 *
 * Lists the files attached to a dispute as cards, previews the ones a browser can
 * render inline, downloads the rest, and accepts new attachments while the dispute
 * is open.
 *
 * ## Why evidence comes in as a prop
 *
 * There is no backend contract for dispute evidence: `SLADispute` has no evidence
 * field and there is no upload endpoint. Rather than invent one and have this
 * component quietly fail against the real API, it takes its list and its upload
 * handler from the caller — the same shape the existing admin panels use. See the
 * `TODO(#640)` on `DisputeEvidence` for the migration.
 *
 * @param props - Evidence list, active flag and handlers.
 * @returns The evidence card grid, upload control and preview pane.
 */
export function EvidenceManager({
  evidence,
  isActive = false,
  onAddEvidence,
  onDownload,
  className,
}: EvidenceManagerProps) {
  const [preview, setPreview] = useState<DisputeEvidence | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const download = useCallback(
    (item: DisputeEvidence) => {
      if (onDownload) {
        onDownload(item);
        return;
      }

      // A plain anchor click, so the browser applies its own download handling
      // rather than this component trying to stream the bytes itself.
      const anchor = document.createElement("a");
      anchor.href = item.url;
      anchor.download = item.filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [onDownload],
  );

  const open = useCallback(
    (item: DisputeEvidence) => {
      if (isPreviewable(evidenceKind(item.content_type))) {
        setPreview(item);
        return;
      }
      download(item);
    },
    [download],
  );

  const canUpload = isActive && Boolean(onAddEvidence);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Evidence</CardTitle>
        {canUpload && (
          <>
            <label htmlFor={inputId} className="sr-only">
              Attach evidence files
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,application/json,text/plain"
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) void onAddEvidence?.(files);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Add evidence
            </Button>
          </>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No evidence has been attached to this dispute.
          </p>
        ) : (
          <ul
            aria-label="Attached evidence"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {evidence.map((item) => {
              const kind = evidenceKind(item.content_type);
              const previewable = isPreviewable(kind);
              const size = formatSize(item.size_bytes);

              return (
                <li key={item.id}>
                  <div className="flex h-full items-start justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <KindIcon kind={kind} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {KIND_LABEL[kind]}
                          {size ? ` · ${size}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => open(item)}
                        // The label states what will happen, because a preview and
                        // a download are very different outcomes for a screen
                        // reader user about to press it.
                        aria-label={
                          previewable
                            ? `Preview ${item.filename}`
                            : `Download ${item.filename}`
                        }
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {previewable ? (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Download className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>

                      {previewable && (
                        <button
                          type="button"
                          onClick={() => download(item)}
                          aria-label={`Download ${item.filename}`}
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isActive && !onAddEvidence && (
          <p className="text-xs text-muted-foreground">
            This dispute is open, but no upload handler is wired up yet.
          </p>
        )}

        {!isActive && evidence.length > 0 && (
          <p className="text-xs text-muted-foreground">
            This dispute is closed; evidence is read-only.
          </p>
        )}
      </CardContent>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${preview.filename}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setPreview(null);
          }}
        >
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between gap-3 border-b border-border p-3">
              <p className="truncate text-sm font-medium">{preview.filename}</p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => download(preview)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Download
                </Button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setPreview(null)}
                  aria-label="Close preview"
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="overflow-auto p-3">
              {evidenceKind(preview.content_type) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={`Evidence: ${preview.filename}`}
                  className={cn("mx-auto max-h-[70vh] w-auto")}
                />
              ) : (
                <object
                  data={preview.url}
                  type="application/pdf"
                  aria-label={`Evidence: ${preview.filename}`}
                  className="h-[70vh] w-full"
                >
                  {/* Shown when the browser declines to embed the PDF. */}
                  <p className="text-sm text-muted-foreground">
                    This PDF cannot be displayed here.{" "}
                    <button
                      type="button"
                      onClick={() => download(preview)}
                      className="underline"
                    >
                      Download it instead
                    </button>
                    .
                  </p>
                </object>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default EvidenceManager;
