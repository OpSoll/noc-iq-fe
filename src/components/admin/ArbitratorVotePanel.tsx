"use client";

import { useCallback, useId, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ArbitrationTally,
  ArbitrationVote,
  ArbitrationVoteSubmission,
} from "@/types/sla";

/** Shortest rationale accepted with a vote. */
export const MIN_RATIONALE_LENGTH = 20;

export interface VoteFormErrors {
  vote?: string;
  rationale?: string;
}

const VOTE_OPTIONS: Array<{
  value: ArbitrationVote;
  label: string;
  detail: string;
}> = [
  {
    value: "upheld",
    label: "Upheld",
    detail: "SLA breached — the customer's dispute is correct",
  },
  {
    value: "dismissed",
    label: "Dismissed",
    detail: "No breach — the original SLA outcome stands",
  },
];

/**
 * Validates an arbitrator's submission (issue #641).
 *
 * Exported and pure so the rules are testable without rendering.
 *
 * A rationale is mandatory, which the issue does not explicitly demand. An
 * arbitration vote moves money and is the record of why: a decision with no stated
 * reason cannot be reviewed, appealed against, or audited later, and by the time
 * anyone needs it the arbitrator will not remember. The minimum length exists to
 * stop "ok" counting as reasoning.
 *
 * @param vote - Selected decision, or null when nothing is chosen.
 * @param rationale - The arbitrator's notes.
 * @returns Field errors; empty when the submission is valid.
 */
export function validateVote(
  vote: ArbitrationVote | null,
  rationale: string,
): VoteFormErrors {
  const errors: VoteFormErrors = {};

  if (!vote) {
    errors.vote = "Select Upheld or Dismissed.";
  }

  const trimmed = rationale.trim();
  if (trimmed.length === 0) {
    errors.rationale = "Rationale notes are required.";
  } else if (trimmed.length < MIN_RATIONALE_LENGTH) {
    errors.rationale = `Explain the decision in at least ${MIN_RATIONALE_LENGTH} characters.`;
  }

  return errors;
}

/**
 * Renders the vote tally as the issue words it.
 *
 * @param tally - Current counts.
 * @returns E.g. "2 of 3 votes cast".
 */
export function formatTally(tally: ArbitrationTally): string {
  return `${tally.cast} of ${tally.required} votes cast`;
}

export interface ArbitratorVotePanelProps {
  tally: ArbitrationTally;
  /** Submits this arbitrator's decision. */
  onSubmitVote: (submission: ArbitrationVoteSubmission) => void | Promise<void>;
  /**
   * This arbitrator's existing vote, when they have already voted. The form is
   * replaced by a summary — an arbitrator casting a second vote would either
   * double-count or silently overwrite, and neither is a decision anyone can audit.
   */
  existingVote?: ArbitrationVoteSubmission | null;
  /** Set false for a non-arbitrator viewer; the panel becomes read-only. */
  canVote?: boolean;
  className?: string;
}

/**
 * Arbitration vote panel (issue #641).
 *
 * Arbitrators had no UI to submit a settlement vote. This offers Upheld or
 * Dismissed with mandatory rationale notes, and shows the running tally.
 *
 * Takes its tally and submit handler as props: there is no backend contract for
 * arbitration votes yet. See the `TODO(#641)` on `ArbitrationTally`.
 *
 * @param props - Tally, submit handler and viewer permissions.
 * @returns The vote form, or a summary once this arbitrator has voted.
 */
export function ArbitratorVotePanel({
  tally,
  onSubmitVote,
  existingVote = null,
  canVote = true,
  className,
}: ArbitratorVotePanelProps) {
  const groupId = useId();

  const [vote, setVote] = useState<ArbitrationVote | null>(null);
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<VoteFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const complete = tally.cast >= tally.required;

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const found = validateVote(vote, rationale);
      setErrors(found);
      if (Object.keys(found).length > 0 || !vote) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        await onSubmitVote({ vote, rationale: rationale.trim() });
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Could not submit the vote.";
        setSubmitError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmitVote, rationale, vote],
  );

  const rationaleErrorId = `${groupId}-rationale-error`;
  const voteErrorId = `${groupId}-vote-error`;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Arbitration decision</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium" aria-live="polite">
            {formatTally(tally)}
          </p>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${tally.upheld} upheld, ${tally.dismissed} dismissed, ${formatTally(tally)}`}
          >
            <span
              className="bg-green-600 dark:bg-green-500"
              style={{
                width: `${(tally.upheld / Math.max(tally.required, 1)) * 100}%`,
              }}
            />
            <span
              className="bg-destructive"
              style={{
                width: `${(tally.dismissed / Math.max(tally.required, 1)) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {tally.upheld} upheld · {tally.dismissed} dismissed
          </p>
        </div>

        {existingVote ? (
          <div className="rounded-md border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              {existingVote.vote === "upheld" ? (
                <CheckCircle2
                  className="h-4 w-4 text-green-600 dark:text-green-400"
                  aria-hidden="true"
                />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
              )}
              You voted to{" "}
              {existingVote.vote === "upheld" ? "uphold" : "dismiss"} this dispute
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {existingVote.rationale}
            </p>
          </div>
        ) : !canVote ? (
          <p className="text-sm text-muted-foreground">
            You do not have arbitrator permissions for this dispute.
          </p>
        ) : complete ? (
          <p className="text-sm text-muted-foreground">
            Voting is closed; the required votes have already been cast.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <fieldset>
              <legend className="text-sm font-medium">Your decision</legend>
              <div
                role="radiogroup"
                aria-labelledby={undefined}
                aria-describedby={errors.vote ? voteErrorId : undefined}
                aria-invalid={Boolean(errors.vote)}
                className="mt-2 space-y-2"
              >
                {VOTE_OPTIONS.map((option) => {
                  const selected = vote === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${groupId}-vote`}
                        value={option.value}
                        checked={selected}
                        onChange={() => {
                          setVote(option.value);
                          setErrors((current) => {
                            if (!current.vote) return current;
                            const next = { ...current };
                            delete next.vote;
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {option.detail}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.vote && (
                <p id={voteErrorId} role="alert" className="mt-1 text-xs text-destructive">
                  {errors.vote}
                </p>
              )}
            </fieldset>

            <div>
              <label
                htmlFor={`${groupId}-rationale`}
                className="text-sm font-medium"
              >
                Rationale notes <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <textarea
                id={`${groupId}-rationale`}
                rows={4}
                value={rationale}
                onChange={(event) => {
                  setRationale(event.target.value);
                  setErrors((current) => {
                    if (!current.rationale) return current;
                    const next = { ...current };
                    delete next.rationale;
                    return next;
                  });
                }}
                aria-invalid={Boolean(errors.rationale)}
                aria-describedby={errors.rationale ? rationaleErrorId : undefined}
                className={cn(
                  "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  errors.rationale ? "border-destructive" : "border-border",
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded with your vote and visible to the other arbitrators.
              </p>
              {errors.rationale && (
                <p
                  id={rationaleErrorId}
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.rationale}
                </p>
              )}
            </div>

            {submitError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {submitError}
              </p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                "Submit vote"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default ArbitratorVotePanel;
