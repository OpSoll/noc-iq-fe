/**
 * Type-to-confirm rules for destructive webhook deletion.
 *
 * Deleting an endpoint silently stops every alert that receiver was providing,
 * and the failure is invisible until an outage goes unnotified. Requiring the
 * operator to type the endpoint's identifier turns a reflexive click into a
 * deliberate act, and gives the confirmation a second purpose: it proves the
 * person at the keyboard has read which endpoint is about to disappear.
 *
 * Closes #672 — webhook endpoint deletion confirmation modal.
 */

export interface DeleteConfirmState {
  canDelete: boolean;
  /** True once the typed value matches the target identifier. */
  isConfirmed: boolean;
  message: string | null;
}

/**
 * Compares the typed confirmation against the target.
 *
 * The match is trimmed and case-insensitive, since an endpoint URL or ID is
 * easy to mistype in ways that are not a safety concern.
 */
export function getDeleteConfirmState(
  typed: string,
  target: string
): DeleteConfirmState {
  const expected = (target ?? '').trim();
  const actual = (typed ?? '').trim();

  if (!expected) {
    return {
      canDelete: false,
      isConfirmed: false,
      message: 'This endpoint has no identifier to confirm against.',
    };
  }

  if (!actual) {
    return {
      canDelete: false,
      isConfirmed: false,
      message: `Type the endpoint to confirm deletion.`,
    };
  }

  if (actual.toLowerCase() === expected.toLowerCase()) {
    return { canDelete: true, isConfirmed: true, message: null };
  }

  return {
    canDelete: false,
    isConfirmed: false,
    message: 'The text does not match the endpoint.',
  };
}

/** Short, unambiguous label for the endpoint being deleted. */
export function getEndpointLabel(url: string | null | undefined): string {
  if (!url) return '(no URL)';
  const trimmed = url.trim();
  if (!trimmed) return '(no URL)';
  // A full URL is long and noisy; the host plus final path segment identifies
  // the receiver well enough to type.
  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const tail = segments.length > 0 ? `/${segments[segments.length - 1]}` : '';
    return `${parsed.host}${tail}`;
  } catch {
    return trimmed;
  }
}
