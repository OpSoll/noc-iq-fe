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
  /** SLA result the dispute contests, when the caller knows it. */
  sla_result_id?: string;
  /**
   * Supporting evidence URLs (issue #638).
   *
   * TODO(#638): optional until the backend accepts it. The dispute form collects
   * these and sends them; a backend that ignores unknown keys will simply drop
   * them, so nothing breaks in the meantime. Migration: make this part of the
   * documented contract, and surface the stored links in SLADispute so the
   * evidence manager can read them back.
   */
  evidence_links?: string[];
  /**
   * Penalty amount the customer claims is owed (issue #638).
   *
   * TODO(#638): optional until the backend accepts it. Same migration note as
   * evidence_links.
   */
  claimed_penalty_amount?: number;
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
