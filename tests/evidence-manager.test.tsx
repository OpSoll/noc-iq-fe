import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  EvidenceManager,
  evidenceKind,
  isPreviewable,
} from "@/components/admin/EvidenceManager";
import type { DisputeEvidence } from "@/types/sla";

const item = (overrides: Partial<DisputeEvidence> = {}): DisputeEvidence => ({
  id: "e1",
  filename: "report.pdf",
  content_type: "application/pdf",
  url: "https://files.example/report.pdf",
  size_bytes: 2048,
  ...overrides,
});

const PDF = item();
const PNG = item({
  id: "e2",
  filename: "graph.png",
  content_type: "image/png",
  url: "https://files.example/graph.png",
});
const JSON_FILE = item({
  id: "e3",
  filename: "telemetry.json",
  content_type: "application/json",
  url: "https://files.example/telemetry.json",
});
const TXT = item({
  id: "e4",
  filename: "notes.txt",
  content_type: "text/plain",
  url: "https://files.example/notes.txt",
});

/**
 * Issue #640 — arbitration evidence attachment manager.
 */
describe("evidenceKind", () => {
  it("classifies the four types the issue names", () => {
    expect(evidenceKind("application/pdf")).toBe("pdf");
    expect(evidenceKind("image/png")).toBe("image");
    expect(evidenceKind("application/json")).toBe("json");
    expect(evidenceKind("text/plain")).toBe("text");
  });

  it("is case-insensitive and handles suffixed json", () => {
    expect(evidenceKind("IMAGE/JPEG")).toBe("image");
    expect(evidenceKind("application/vnd.api+json")).toBe("json");
  });

  it("falls back for anything unrecognised", () => {
    expect(evidenceKind("application/zip")).toBe("other");
    expect(evidenceKind("")).toBe("other");
  });
});

describe("isPreviewable", () => {
  it("previews images and PDFs only", () => {
    expect(isPreviewable("image")).toBe(true);
    expect(isPreviewable("pdf")).toBe(true);
    // JSON and text would need their contents fetched from an arbitrary URL.
    expect(isPreviewable("json")).toBe(false);
    expect(isPreviewable("text")).toBe(false);
    expect(isPreviewable("other")).toBe(false);
  });
});

describe("EvidenceManager", () => {
  it("renders a card per attachment", () => {
    render(<EvidenceManager evidence={[PDF, PNG, JSON_FILE, TXT]} />);

    expect(screen.getByRole("list", { name: "Attached evidence" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const name of ["report.pdf", "graph.png", "telemetry.json", "notes.txt"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("labels each card with its type and size", () => {
    render(<EvidenceManager evidence={[PDF]} />);

    expect(screen.getByText("PDF · 2.0 KB")).toBeInTheDocument();
  });

  it("omits the size when the server did not report one", () => {
    render(<EvidenceManager evidence={[item({ size_bytes: undefined })]} />);

    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("says so when there is no evidence", () => {
    render(<EvidenceManager evidence={[]} />);

    expect(
      screen.getByText(/no evidence has been attached/i),
    ).toBeInTheDocument();
  });

  describe("opening an attachment", () => {
    it("opens a preview for an image", () => {
      render(<EvidenceManager evidence={[PNG]} />);

      fireEvent.click(screen.getByRole("button", { name: "Preview graph.png" }));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAccessibleName("Preview of graph.png");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(screen.getByAltText("Evidence: graph.png")).toHaveAttribute(
        "src",
        PNG.url,
      );
    });

    it("opens a preview for a PDF", () => {
      render(<EvidenceManager evidence={[PDF]} />);

      fireEvent.click(screen.getByRole("button", { name: "Preview report.pdf" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Evidence: report.pdf"),
      ).toBeInTheDocument();
    });

    it("downloads a JSON attachment rather than previewing it", () => {
      const onDownload = vi.fn();
      render(<EvidenceManager evidence={[JSON_FILE]} onDownload={onDownload} />);

      fireEvent.click(
        screen.getByRole("button", { name: "Download telemetry.json" }),
      );

      expect(onDownload).toHaveBeenCalledWith(JSON_FILE);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("downloads a text attachment rather than previewing it", () => {
      const onDownload = vi.fn();
      render(<EvidenceManager evidence={[TXT]} onDownload={onDownload} />);

      fireEvent.click(screen.getByRole("button", { name: "Download notes.txt" }));

      expect(onDownload).toHaveBeenCalledWith(TXT);
    });

    it("says in the label what pressing will do", () => {
      render(<EvidenceManager evidence={[PNG, TXT]} />);

      // A preview and a download are very different outcomes to land on.
      expect(
        screen.getByRole("button", { name: "Preview graph.png" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download notes.txt" }),
      ).toBeInTheDocument();
    });

    it("offers a download alongside a previewable file", () => {
      const onDownload = vi.fn();
      render(<EvidenceManager evidence={[PNG]} onDownload={onDownload} />);

      fireEvent.click(screen.getByRole("button", { name: "Download graph.png" }));

      expect(onDownload).toHaveBeenCalledWith(PNG);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("the preview pane", () => {
    it("closes on the close button", () => {
      render(<EvidenceManager evidence={[PNG]} />);
      fireEvent.click(screen.getByRole("button", { name: "Preview graph.png" }));

      fireEvent.click(screen.getByRole("button", { name: "Close preview" }));

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes on Escape", () => {
      render(<EvidenceManager evidence={[PNG]} />);
      fireEvent.click(screen.getByRole("button", { name: "Preview graph.png" }));

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("can download the file being previewed", () => {
      const onDownload = vi.fn();
      render(<EvidenceManager evidence={[PNG]} onDownload={onDownload} />);
      fireEvent.click(screen.getByRole("button", { name: "Preview graph.png" }));

      fireEvent.click(
        screen.getByRole("button", { name: /^Download$/ }),
      );

      expect(onDownload).toHaveBeenCalledWith(PNG);
    });
  });

  describe("adding evidence", () => {
    it("offers upload while the dispute is active", () => {
      render(
        <EvidenceManager evidence={[]} isActive onAddEvidence={vi.fn()} />,
      );

      expect(
        screen.getByRole("button", { name: /add evidence/i }),
      ).toBeInTheDocument();
    });

    it("hides upload once the dispute is closed", () => {
      render(
        <EvidenceManager
          evidence={[PDF]}
          isActive={false}
          onAddEvidence={vi.fn()}
        />,
      );

      // Attaching to a closed dispute would imply it will be considered.
      expect(screen.queryByRole("button", { name: /add evidence/i })).toBeNull();
      expect(screen.getByText(/evidence is read-only/i)).toBeInTheDocument();
    });

    it("passes chosen files to the handler", () => {
      const onAddEvidence = vi.fn();
      render(
        <EvidenceManager evidence={[]} isActive onAddEvidence={onAddEvidence} />,
      );

      const input = document.querySelector("input[type='file']") as HTMLInputElement;
      const chosen = new File(["x"], "extra.pdf", { type: "application/pdf" });
      fireEvent.change(input, { target: { files: [chosen] } });

      expect(onAddEvidence).toHaveBeenCalledTimes(1);
      expect(onAddEvidence.mock.calls[0][0][0].name).toBe("extra.pdf");
    });

    it("accepts several files at once", () => {
      const onAddEvidence = vi.fn();
      render(
        <EvidenceManager evidence={[]} isActive onAddEvidence={onAddEvidence} />,
      );

      const input = document.querySelector("input[type='file']") as HTMLInputElement;
      expect(input).toHaveAttribute("multiple");

      fireEvent.change(input, {
        target: {
          files: [
            new File(["a"], "a.pdf", { type: "application/pdf" }),
            new File(["b"], "b.png", { type: "image/png" }),
          ],
        },
      });

      expect(onAddEvidence.mock.calls[0][0]).toHaveLength(2);
    });

    it("ignores an empty selection", () => {
      const onAddEvidence = vi.fn();
      render(
        <EvidenceManager evidence={[]} isActive onAddEvidence={onAddEvidence} />,
      );

      const input = document.querySelector("input[type='file']") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [] } });

      expect(onAddEvidence).not.toHaveBeenCalled();
    });

    it("explains an active dispute with no upload handler wired up", () => {
      render(<EvidenceManager evidence={[]} isActive />);

      expect(screen.queryByRole("button", { name: /add evidence/i })).toBeNull();
      expect(screen.getByText(/no upload handler is wired up/i)).toBeInTheDocument();
    });
  });
});
