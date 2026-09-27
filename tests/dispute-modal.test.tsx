import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DisputeModal,
  MIN_REASON_LENGTH,
  parseEvidenceLinks,
  validateDisputeForm,
} from "@/components/outages/DisputeModal";
import type { SLADispute } from "@/types/sla";

// See the note in dry-run-toggle.test.tsx: the real toast animates with a
// requestAnimationFrame loop that makes post-toast assertions time out.
const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => toastSpy,
}));

const filed: SLADispute = {
  id: "d1",
  outage_id: "o1",
  status: "open",
  reason: "Availability was miscalculated for the maintenance window.",
  created_at: "2026-02-01T10:00:00Z",
};

function openModal(
  props: Partial<React.ComponentProps<typeof DisputeModal>> = {},
) {
  const submitDispute = props.submitDispute ?? vi.fn().mockResolvedValue(filed);

  render(
    <DisputeModal
      outageId="o1"
      open
      {...props}
      submitDispute={submitDispute}
    />,
  );

  return { submitDispute };
}

const reasonField = () => screen.getByLabelText(/dispute reason/i);
const penaltyField = () => screen.getByLabelText(/claimed penalty value/i);
const linksField = () => screen.getByLabelText(/evidence links/i);
const submit = () => screen.getByRole("button", { name: /file dispute/i });

const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

const VALID_REASON = "Availability was miscalculated for the window.";

/**
 * Issue #638 — dispute filing modal.
 *
 * The acceptance criterion the issue leans on is that mandatory fields are
 * validated *before* submission, so most of these assert that the submitter was
 * never called.
 */
describe("validateDisputeForm", () => {
  const valid = {
    reason: VALID_REASON,
    evidenceLinks: "",
    claimedPenalty: "250",
  };

  it("accepts a complete form", () => {
    expect(validateDisputeForm(valid)).toEqual({});
  });

  it("requires a reason", () => {
    expect(validateDisputeForm({ ...valid, reason: "   " }).reason).toMatch(
      /required/i,
    );
  });

  it("requires a reason with some substance", () => {
    const errors = validateDisputeForm({ ...valid, reason: "nope" });

    expect(errors.reason).toContain(String(MIN_REASON_LENGTH));
  });

  it("requires a claimed penalty", () => {
    expect(
      validateDisputeForm({ ...valid, claimedPenalty: "" }).claimedPenalty,
    ).toMatch(/required/i);
  });

  it("rejects a non-numeric penalty", () => {
    expect(
      validateDisputeForm({ ...valid, claimedPenalty: "lots" }).claimedPenalty,
    ).toMatch(/number/i);
  });

  it("rejects a penalty of zero or less", () => {
    expect(
      validateDisputeForm({ ...valid, claimedPenalty: "0" }).claimedPenalty,
    ).toMatch(/greater than zero/i);
    expect(
      validateDisputeForm({ ...valid, claimedPenalty: "-5" }).claimedPenalty,
    ).toMatch(/greater than zero/i);
  });

  it("treats evidence as optional", () => {
    expect(
      validateDisputeForm({ ...valid, evidenceLinks: "" }).evidenceLinks,
    ).toBeUndefined();
  });

  it("rejects an evidence entry that is not a URL", () => {
    const errors = validateDisputeForm({
      ...valid,
      evidenceLinks: "https://ok.example/a\nnot-a-url",
    });

    // A typo here silently costs the customer their evidence.
    expect(errors.evidenceLinks).toContain("not-a-url");
  });

  it("accepts several valid URLs", () => {
    expect(
      validateDisputeForm({
        ...valid,
        evidenceLinks: "https://a.example/1\nhttp://b.example/2",
      }).evidenceLinks,
    ).toBeUndefined();
  });

  it("reports every invalid field at once", () => {
    const errors = validateDisputeForm({
      reason: "",
      claimedPenalty: "",
      evidenceLinks: "nope",
    });

    // Revealing one problem at a time turns filing into a guessing game.
    expect(Object.keys(errors).sort()).toEqual([
      "claimedPenalty",
      "evidenceLinks",
      "reason",
    ]);
  });
});

describe("parseEvidenceLinks", () => {
  it("splits on newlines and trims", () => {
    expect(parseEvidenceLinks("  a \n\n b \r\nc  ")).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for blank input", () => {
    expect(parseEvidenceLinks("   \n  ")).toEqual([]);
  });
});

/**
 * A longer timeout than the 5s default: mounting the Radix alert dialog in jsdom
 * (portal, focus scope, scroll lock) is slow enough on a loaded machine to trip
 * it, and a flaky suite is worse than a slow one. The pure-function suites above
 * keep the default.
 */
describe("DisputeModal", { timeout: 20_000 }, () => {
  beforeEach(() => toastSpy.mockReset());

  it("provides the three inputs the issue names", () => {
    openModal();

    expect(reasonField()).toBeInTheDocument();
    expect(linksField()).toBeInTheDocument();
    expect(penaltyField()).toBeInTheDocument();
  });

  it("does not submit while mandatory fields are empty", () => {
    const { submitDispute } = openModal();

    fireEvent.click(submit());

    expect(submitDispute).not.toHaveBeenCalled();
    expect(screen.getByText(/dispute reason is required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/claimed penalty value is required/i),
    ).toBeInTheDocument();
  });

  it("marks invalid fields for assistive tech", () => {
    openModal();

    fireEvent.click(submit());

    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
    expect(penaltyField()).toHaveAttribute("aria-invalid", "true");
    expect(reasonField()).toHaveAccessibleDescription(
      /dispute reason is required/i,
    );
  });

  it("clears a field error as soon as it is edited", () => {
    openModal();
    fireEvent.click(submit());
    expect(screen.getByText(/dispute reason is required/i)).toBeInTheDocument();

    type(reasonField(), "a");

    // Leaving the error up while the user fixes it reads as the form arguing.
    expect(screen.queryByText(/dispute reason is required/i)).toBeNull();
  });

  it("blocks submission on a malformed evidence link", () => {
    const { submitDispute } = openModal();

    type(reasonField(), VALID_REASON);
    type(penaltyField(), "250");
    type(linksField(), "ftp://nope");
    fireEvent.click(submit());

    expect(submitDispute).not.toHaveBeenCalled();
    expect(screen.getByText(/is not a valid http\(s\) URL/i)).toBeInTheDocument();
  });

  it("submits a complete dispute to the backend", async () => {
    const { submitDispute } = openModal({ slaResultId: "sla-9" });

    type(reasonField(), VALID_REASON);
    type(penaltyField(), "250.50");
    type(linksField(), "https://status.example/1\nhttps://status.example/2");
    fireEvent.click(submit());

    await waitFor(() => expect(submitDispute).toHaveBeenCalledTimes(1));
    expect(submitDispute).toHaveBeenCalledWith({
      outage_id: "o1",
      sla_result_id: "sla-9",
      reason: VALID_REASON,
      evidence_links: ["https://status.example/1", "https://status.example/2"],
      claimed_penalty_amount: 250.5,
    });
  });

  it("omits evidence links when none were given", async () => {
    const { submitDispute } = openModal();

    type(reasonField(), VALID_REASON);
    type(penaltyField(), "10");
    fireEvent.click(submit());

    await waitFor(() => expect(submitDispute).toHaveBeenCalledTimes(1));
    expect(submitDispute.mock.calls[0][0]).not.toHaveProperty("evidence_links");
  });

  it("confirms success with a toast and closes", async () => {
    const onOpenChange = vi.fn();
    const onFiled = vi.fn();
    openModal({ onOpenChange, onFiled });

    type(reasonField(), VALID_REASON);
    type(penaltyField(), "10");
    fireEvent.click(submit());

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        "Dispute filed successfully.",
        "success",
      ),
    );
    expect(onFiled).toHaveBeenCalledWith(filed);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the form open and reports a submission failure", async () => {
    const onOpenChange = vi.fn();
    openModal({
      onOpenChange,
      submitDispute: vi.fn().mockRejectedValue(new Error("409 already disputed")),
    });

    type(reasonField(), VALID_REASON);
    type(penaltyField(), "10");
    fireEvent.click(submit());

    // Closing on failure would throw away what the customer typed.
    expect(await screen.findByText("409 already disputed")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith("409 already disputed", "error"),
    );
  });

  it("exposes the modal as a titled dialog", () => {
    openModal();

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("File an SLA dispute");
    expect(dialog).toHaveAccessibleDescription(/explain why you believe/i);
  });
});
