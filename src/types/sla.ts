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

export type EscalationPriority = "low" | "normal" | "high" | "critical";

export interface DisputeAttachment {
  id: string;
  filename: string;
  url: string;
  /** e.g. "application/pdf", "image/png", "image/jpeg" */
  content_type: string;
  size_bytes?: number;
}

export interface SLADispute {
  id: string;
  outage_id: string;
  sla_result_id?: string;
  status: DisputeStatus;
  reason: string;
  created_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
  /** Evidence documents attached by the disputing party. */
  attachments?: DisputeAttachment[];
  /** Present when the dispute has been escalated to senior management. */
  escalated_at?: string | null;
  escalated_priority?: EscalationPriority | null;
  escalated_manager?: string | null;
}

export interface FlagDisputePayload {
  outage_id: string;
  reason: string;
}

export interface ResolveDisputePayload {
  action: "resolve" | "reject";
  resolution_note?: string;
  /** Stakeholder email addresses to notify of the resolution. */
  notify_recipients?: string[];
}

export interface EscalateDisputePayload {
  priority: EscalationPriority;
  /** Tag/email handle of the senior manager the dispute is escalated to. */
  manager_tag: string;
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
