"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { flagDispute } from "@/services/sla";
import type { FlagDisputePayload, SLADispute } from "@/types/sla";

/** Shortest dispute reason the form accepts. */
export const MIN_REASON_LENGTH = 10;

export interface DisputeFormValues {
  reason: string;
  /** One URL per line, as typed. */
  evidenceLinks: string;
  /** Kept as a string so an empty field is distinguishable from zero. */
  claimedPenalty: string;
}

export type DisputeFieldErrors = Partial<
  Record<keyof DisputeFormValues, string>
>;

const HTTP_URL = /^https?:\/\/\S+$/i;

/**
 * Splits the evidence textarea into individual URLs.
 *
 * @param raw - Textarea contents.
 * @returns Non-empty trimmed lines.
 */
export function parseEvidenceLinks(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Validates the dispute form (issue #638).
 *
 * Exported and pure so the rules can be tested without rendering, and so the
 * same rules can be reused if the form is ever embedded somewhere else.
 *
 * Reason and claimed penalty are mandatory: a dispute with no stated reason is
 * not actionable, and one with no claimed amount gives an arbitrator nothing to
 * rule on. Evidence is optional — a customer may have nothing to attach yet —
 * but a link that is present must be a real URL, because a typo here silently
 * costs the customer their case.
 *
 * @param values - Raw form values.
 * @returns A map of field name to message; empty when the form is valid.
 */
export function validateDisputeForm(
  values: DisputeFormValues,
): DisputeFieldErrors {
  const errors: DisputeFieldErrors = {};

  const reason = values.reason.trim();
  if (reason.length === 0) {
    errors.reason = "A dispute reason is required.";
  } else if (reason.length < MIN_REASON_LENGTH) {
    errors.reason = `Describe the dispute in at least ${MIN_REASON_LENGTH} characters.`;
  }

  const penalty = values.claimedPenalty.trim();
  if (penalty.length === 0) {
    errors.claimedPenalty = "A claimed penalty value is required.";
  } else {
    const parsed = Number(penalty);
    if (!Number.isFinite(parsed)) {
      errors.claimedPenalty = "Enter the claimed penalty as a number.";
    } else if (parsed <= 0) {
      errors.claimedPenalty = "The claimed penalty must be greater than zero.";
    }
  }

  const links = parseEvidenceLinks(values.evidenceLinks);
  const badLink = links.find((link) => !HTTP_URL.test(link));
  if (badLink) {
    errors.evidenceLinks = `"${badLink}" is not a valid http(s) URL.`;
  }

  return errors;
}

const EMPTY_FORM: DisputeFormValues = {
  reason: "",
  evidenceLinks: "",
  claimedPenalty: "",
};

export interface DisputeModalProps {
  outageId: string;
  /** SLA result being contested, forwarded to the backend when known. */
  slaResultId?: string;
  /** Controlled open state. Left out, the modal manages its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trigger rendered when the modal is uncontrolled. */
  trigger?: React.ReactNode;
  /** Submitter. Injectable so tests need no server. */
  submitDispute?: (payload: FlagDisputePayload) => Promise<SLADispute>;
  onFiled?: (dispute: SLADispute) => void;
}

/**
 * Formal dispute filing modal (issue #638).
 *
 * Customers previously had to contact support to raise an SLA dispute because no
 * UI existed for it.
 *
 * ## Why this is built on AlertDialog
 *
 * The repository has `@radix-ui/react-alert-dialog` but not `react-dialog`, and
 * adding a dependency for one modal would trip the dependency policy check for no
 * real gain. `role="alertdialog"` is a subtype of `dialog`, so assistive tech
 * still treats it as a modal, and it brings the focus trap, Escape handling and
 * focus return with it. It also declines to close on an overlay click, which is
 * the behaviour you want for a form — a stray click should not discard a typed
 * dispute.
 *
 * Submission is a plain form submit rather than `AlertDialogAction`, because the
 * action element closes the dialog on click and validation has to be able to keep
 * it open.
 *
 * @param props - Outage id, optional controlled state, submitter and callbacks.
 * @returns The trigger and the dispute form modal.
 */
export function DisputeModal({
  outageId,
  slaResultId,
  open,
  onOpenChange,
  trigger,
  submitDispute = flagDispute,
  onFiled,
}: DisputeModalProps) {
  const toast = useToast();
  const fieldId = useId();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const [values, setValues] = useState<DisputeFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<DisputeFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
      if (!next) {
        // Reset on close so a reopened modal is not pre-filled with a stale,
        // half-typed dispute.
        setValues(EMPTY_FORM);
        setErrors({});
        setSubmitError(null);
      }
    },
    [isControlled, onOpenChange],
  );

  const update = useCallback(
    <K extends keyof DisputeFormValues>(key: K, value: string) => {
      setValues((current) => ({ ...current, [key]: value }));
      // Clear the field's error as soon as it is edited; leaving it visible while
      // the user fixes it reads as the form arguing with them.
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const ids = useMemo(
    () => ({
      reason: `${fieldId}-reason`,
      reasonError: `${fieldId}-reason-error`,
      links: `${fieldId}-links`,
      linksError: `${fieldId}-links-error`,
      penalty: `${fieldId}-penalty`,
      penaltyError: `${fieldId}-penalty-error`,
    }),
    [fieldId],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found = validateDisputeForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const links = parseEvidenceLinks(values.evidenceLinks);
    const payload: FlagDisputePayload = {
      outage_id: outageId,
      reason: values.reason.trim(),
      ...(slaResultId ? { sla_result_id: slaResultId } : {}),
      ...(links.length > 0 ? { evidence_links: links } : {}),
      claimed_penalty_amount: Number(values.claimedPenalty.trim()),
    };

    try {
      const dispute = await submitDispute(payload);
      toast("Dispute filed successfully.", "success");
      onFiled?.(dispute);
      setOpen(false);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not file the dispute.";
      setSubmitError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (invalid: boolean) =>
    cn(
      "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      invalid ? "border-destructive" : "border-border",
    );

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger !== undefined && !isControlled && (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      )}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>File an SLA dispute</AlertDialogTitle>
          <AlertDialogDescription>
            Explain why you believe the SLA outcome for this outage is wrong. An
            arbitrator will review your reason and any evidence you attach.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor={ids.reason} className="text-sm font-medium">
              Dispute reason <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <textarea
              id={ids.reason}
              rows={4}
              value={values.reason}
              onChange={(event) => update("reason", event.target.value)}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? ids.reasonError : undefined}
              className={fieldClass(Boolean(errors.reason))}
            />
            {errors.reason && (
              <p id={ids.reasonError} role="alert" className="mt-1 text-xs text-destructive">
                {errors.reason}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={ids.penalty} className="text-sm font-medium">
              Claimed penalty value <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id={ids.penalty}
              type="text"
              inputMode="decimal"
              value={values.claimedPenalty}
              onChange={(event) => update("claimedPenalty", event.target.value)}
              aria-invalid={Boolean(errors.claimedPenalty)}
              aria-describedby={
                errors.claimedPenalty ? ids.penaltyError : undefined
              }
              className={fieldClass(Boolean(errors.claimedPenalty))}
            />
            {errors.claimedPenalty && (
              <p
                id={ids.penaltyError}
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {errors.claimedPenalty}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={ids.links} className="text-sm font-medium">
              Evidence links
            </label>
            <textarea
              id={ids.links}
              rows={3}
              placeholder={"https://status.example/incident/123\nhttps://…"}
              value={values.evidenceLinks}
              onChange={(event) => update("evidenceLinks", event.target.value)}
              aria-invalid={Boolean(errors.evidenceLinks)}
              aria-describedby={errors.evidenceLinks ? ids.linksError : undefined}
              className={fieldClass(Boolean(errors.evidenceLinks))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. One URL per line.
            </p>
            {errors.evidenceLinks && (
              <p
                id={ids.linksError}
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {errors.evidenceLinks}
              </p>
            )}
          </div>

          {submitError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Filing…
                </>
              ) : (
                "File dispute"
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DisputeModal;
