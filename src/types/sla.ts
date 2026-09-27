export interface SLAResult {
  outage_id: string;
  status: "met" | "violated";
  mttr_minutes: number;
  threshold_minutes: number;
  amount: number; // negative = penalty, positive = reward
  payment_type: "reward" | "penalty";
  rating: "exceptional" | "excellent" | "good" | "poor";
}

export type DisputeStatus = "open" | "under_review" | "resolved" | "rejected";

export interface SLADispute {
  id: string;
  outage_id: string;
  sla_result_id?: string;
  status: DisputeStatus;
  reason: string;
  created_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
}

export interface FlagDisputePayload {
  outage_id: string;
  reason: string;
}

export interface ResolveDisputePayload {
  action: "resolve" | "reject";
  resolution_note?: string;
}

export interface DisputeListParams {
  outage_id: string;
  status?: DisputeStatus;
  page?: number;
  page_size?: number;
}

export interface PaginatedDisputes {
  items: SLADispute[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * A file attached to a dispute as evidence (issue #640).
 *
 * TODO(#640): there is no backend contract for dispute evidence yet. `SLADispute`
 * carries no evidence field, so the manager takes its list as a prop rather than
 * fetching — which also means evidence links sent when a dispute is filed cannot
 * currently be read back. Migration: add `evidence: DisputeEvidence[]` to
 * `SLADispute`, plus an upload endpoint, then give the manager a default loader
 * and drop the prop requirement.
 */
export interface DisputeEvidence {
  id: string;
  filename: string;
  /** MIME type as reported by the server. */
  content_type: string;
  /** Location to preview or download from. */
  url: string;
  size_bytes?: number;
  uploaded_at?: string;
}

/** An arbitrator's decision on a dispute (issue #641). */
export type ArbitrationVote = "upheld" | "dismissed";

/**
 * Running count of arbitration votes (issue #641).
 *
 * TODO(#641): no backend contract exists for arbitration votes. The panel takes
 * the tally as a prop and reports a decision through a callback. Migration: add a
 * votes endpoint returning this shape, then let the panel load and submit itself.
 */
export interface ArbitrationTally {
  /** Votes cast so far. */
  cast: number;
  /** Votes needed to reach a decision. */
  required: number;
  upheld: number;
  dismissed: number;
}

/** One arbitrator's submitted vote (issue #641). */
export interface ArbitrationVoteSubmission {
  vote: ArbitrationVote;
  rationale: string;
}
