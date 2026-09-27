import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ArbitratorVotePanel,
  MIN_RATIONALE_LENGTH,
  formatTally,
  validateVote,
} from "@/components/admin/ArbitratorVotePanel";
import type { ArbitrationTally } from "@/types/sla";

const tally = (overrides: Partial<ArbitrationTally> = {}): ArbitrationTally => ({
  cast: 1,
  required: 3,
  upheld: 1,
  dismissed: 0,
  ...overrides,
});

const GOOD_RATIONALE =
  "Monitoring confirms the provider's edge was unreachable for 41 minutes.";

const setup = (
  props: Partial<React.ComponentProps<typeof ArbitratorVotePanel>> = {},
) => {
  const onSubmitVote = props.onSubmitVote ?? vi.fn().mockResolvedValue(undefined);
  render(
    <ArbitratorVotePanel tally={tally()} {...props} onSubmitVote={onSubmitVote} />,
  );
  return { onSubmitVote };
};

const upheldOption = () => screen.getByRole("radio", { name: /upheld/i });
const dismissedOption = () => screen.getByRole("radio", { name: /dismissed/i });
const rationaleField = () => screen.getByLabelText(/rationale notes/i);
const submit = () => screen.getByRole("button", { name: /submit vote/i });

/**
 * Issue #641 — arbitrator vote panel.
 */
describe("validateVote", () => {
  it("accepts a decision with a reasoned rationale", () => {
    expect(validateVote("upheld", GOOD_RATIONALE)).toEqual({});
  });

  it("requires a decision", () => {
    expect(validateVote(null, GOOD_RATIONALE).vote).toMatch(/select/i);
  });

  it("requires a rationale", () => {
    // An arbitration vote moves money; a decision with no stated reason cannot be
    // reviewed or audited later.
    expect(validateVote("upheld", "   ").rationale).toMatch(/required/i);
  });

  it("rejects a rationale too short to be reasoning", () => {
    expect(validateVote("dismissed", "ok").rationale).toContain(
      String(MIN_RATIONALE_LENGTH),
    );
  });

  it("reports both problems at once", () => {
    expect(Object.keys(validateVote(null, "")).sort()).toEqual([
      "rationale",
      "vote",
    ]);
  });
});

describe("formatTally", () => {
  it("matches the wording in the issue", () => {
    expect(formatTally(tally({ cast: 2, required: 3 }))).toBe("2 of 3 votes cast");
  });
});

describe("ArbitratorVotePanel", () => {
  it("offers the two decisions with their meanings", () => {
    setup();

    expect(upheldOption()).toBeInTheDocument();
    expect(dismissedOption()).toBeInTheDocument();
    expect(screen.getByText(/SLA breached/i)).toBeInTheDocument();
    expect(screen.getByText(/No breach/i)).toBeInTheDocument();
  });

  it("provides a rationale text area", () => {
    setup();

    expect(rationaleField().tagName).toBe("TEXTAREA");
  });

  it("shows the current tally", () => {
    render(
      <ArbitratorVotePanel
        tally={tally({ cast: 2, required: 3, upheld: 1, dismissed: 1 })}
        onSubmitVote={vi.fn()}
      />,
    );

    expect(screen.getByText("2 of 3 votes cast")).toBeInTheDocument();
    expect(screen.getByText(/1 upheld · 1 dismissed/)).toBeInTheDocument();
  });

  it("describes the tally bar for assistive tech", () => {
    render(
      <ArbitratorVotePanel
        tally={tally({ cast: 2, required: 3, upheld: 1, dismissed: 1 })}
        onSubmitVote={vi.fn()}
      />,
    );

    // The bar is the only place the split is shown graphically.
    expect(
      screen.getByRole("img", {
        name: "1 upheld, 1 dismissed, 2 of 3 votes cast",
      }),
    ).toBeInTheDocument();
  });

  describe("validation", () => {
    it("does not submit without a decision", () => {
      const { onSubmitVote } = setup();

      fireEvent.change(rationaleField(), { target: { value: GOOD_RATIONALE } });
      fireEvent.click(submit());

      expect(onSubmitVote).not.toHaveBeenCalled();
      expect(screen.getByText(/select upheld or dismissed/i)).toBeInTheDocument();
    });

    it("does not submit without a rationale", () => {
      const { onSubmitVote } = setup();

      fireEvent.click(upheldOption());
      fireEvent.click(submit());

      expect(onSubmitVote).not.toHaveBeenCalled();
      expect(screen.getByText(/rationale notes are required/i)).toBeInTheDocument();
    });

    it("marks the rationale invalid for assistive tech", () => {
      setup();

      fireEvent.click(submit());

      expect(rationaleField()).toHaveAttribute("aria-invalid", "true");
      expect(rationaleField()).toHaveAccessibleDescription(/required/i);
    });

    it("clears an error once the field is corrected", () => {
      setup();
      fireEvent.click(submit());
      expect(screen.getByText(/select upheld or dismissed/i)).toBeInTheDocument();

      fireEvent.click(dismissedOption());

      expect(screen.queryByText(/select upheld or dismissed/i)).toBeNull();
    });
  });

  describe("submission", () => {
    it("submits the decision and the trimmed rationale", async () => {
      const { onSubmitVote } = setup();

      fireEvent.click(dismissedOption());
      fireEvent.change(rationaleField(), {
        target: { value: `  ${GOOD_RATIONALE}  ` },
      });
      fireEvent.click(submit());

      await waitFor(() => expect(onSubmitVote).toHaveBeenCalledTimes(1));
      expect(onSubmitVote).toHaveBeenCalledWith({
        vote: "dismissed",
        rationale: GOOD_RATIONALE,
      });
    });

    it("reports a submission failure and keeps the form", async () => {
      setup({
        onSubmitVote: vi.fn().mockRejectedValue(new Error("409 already voted")),
      });

      fireEvent.click(upheldOption());
      fireEvent.change(rationaleField(), { target: { value: GOOD_RATIONALE } });
      fireEvent.click(submit());

      expect(await screen.findByText("409 already voted")).toBeInTheDocument();
      // Losing a typed rationale to a transient failure would be infuriating.
      expect(rationaleField()).toHaveValue(GOOD_RATIONALE);
    });
  });

  describe("states where voting is not offered", () => {
    it("summarises a vote this arbitrator already cast", () => {
      render(
        <ArbitratorVotePanel
          tally={tally()}
          onSubmitVote={vi.fn()}
          existingVote={{ vote: "upheld", rationale: GOOD_RATIONALE }}
        />,
      );

      // A second vote would either double-count or silently overwrite.
      expect(screen.queryByRole("button", { name: /submit vote/i })).toBeNull();
      expect(screen.getByText(/you voted to uphold/i)).toBeInTheDocument();
      expect(screen.getByText(GOOD_RATIONALE)).toBeInTheDocument();
    });

    it("summarises a dismissal", () => {
      render(
        <ArbitratorVotePanel
          tally={tally()}
          onSubmitVote={vi.fn()}
          existingVote={{ vote: "dismissed", rationale: GOOD_RATIONALE }}
        />,
      );

      expect(screen.getByText(/you voted to dismiss/i)).toBeInTheDocument();
    });

    it("is read-only for a viewer without arbitrator permissions", () => {
      render(
        <ArbitratorVotePanel
          tally={tally()}
          onSubmitVote={vi.fn()}
          canVote={false}
        />,
      );

      expect(screen.queryByRole("button", { name: /submit vote/i })).toBeNull();
      expect(
        screen.getByText(/do not have arbitrator permissions/i),
      ).toBeInTheDocument();
      // The tally stays visible; it is not privileged information.
      expect(screen.getByText("1 of 3 votes cast")).toBeInTheDocument();
    });

    it("closes voting once the required votes are in", () => {
      render(
        <ArbitratorVotePanel
          tally={tally({ cast: 3, required: 3, upheld: 2, dismissed: 1 })}
          onSubmitVote={vi.fn()}
        />,
      );

      expect(screen.queryByRole("button", { name: /submit vote/i })).toBeNull();
      expect(screen.getByText(/voting is closed/i)).toBeInTheDocument();
    });
  });
});
