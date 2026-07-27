/**
 * Structured frontend event taxonomy.
 * Typed event definitions for all major user actions.
 */

export type EventCategory = "outage" | "payment" | "webhook" | "auth";

export type OutageAction = "create" | "resolve" | "update";
export type PaymentAction = "process" | "refund";
export type WebhookAction = "create" | "delete";
export type AuthAction = "login" | "logout";

export type EventAction = OutageAction | PaymentAction | WebhookAction | AuthAction;

export interface BaseTelemetryEvent {
  action: EventAction;
  category: EventCategory;
  timestamp: number;
  route: string;
}

export interface OutageEvent extends BaseTelemetryEvent {
  category: "outage";
  outageId?: string;
  severity?: string;
}

export interface PaymentEvent extends BaseTelemetryEvent {
  category: "payment";
  paymentId?: string;
  amount?: number;
}

export interface WebhookEvent extends BaseTelemetryEvent {
  category: "webhook";
  webhookId?: string;
  url?: string;
}

export interface AuthEvent extends BaseTelemetryEvent {
  category: "auth";
  userId?: string;
}

export type TelemetryEvent = OutageEvent | PaymentEvent | WebhookEvent | AuthEvent;

// ── Schema validation ────────────────────────────────────────────────────────

const VALID_CATEGORIES: Set<string> = new Set(["outage", "payment", "webhook", "auth"]);

const ACTIONS_BY_CATEGORY: Record<EventCategory, Set<string>> = {
  outage: new Set(["create", "resolve", "update"]),
  payment: new Set(["process", "refund"]),
  webhook: new Set(["create", "delete"]),
  auth: new Set(["login", "logout"]),
};

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventValidationError";
  }
}

export function validateEvent(event: unknown): event is TelemetryEvent {
  if (typeof event !== "object" || event === null) {
    throw new EventValidationError("Event must be an object");
  }

  const e = event as Record<string, unknown>;

  if (typeof e.action !== "string") {
    throw new EventValidationError("Event must have a string 'action'");
  }

  if (typeof e.category !== "string") {
    throw new EventValidationError("Event must have a string 'category'");
  }

  if (!VALID_CATEGORIES.has(e.category)) {
    throw new EventValidationError(`Invalid category '${e.category}'`);
  }

  const validActions = ACTIONS_BY_CATEGORY[e.category as EventCategory];
  if (!validActions.has(e.action)) {
    throw new EventValidationError(
      `Invalid action '${e.action}' for category '${e.category}'`,
    );
  }

  if (typeof e.timestamp !== "number") {
    throw new EventValidationError("Event must have a numeric 'timestamp'");
  }

  if (typeof e.route !== "string") {
    throw new EventValidationError("Event must have a string 'route'");
  }

  return true;
}

// ── Emitter ──────────────────────────────────────────────────────────────────

let emitFn: ((event: TelemetryEvent) => void) | null = null;

export function setEmitFn(fn: (event: TelemetryEvent) => void): void {
  emitFn = fn;
}

export function resetEmitFn(): void {
  emitFn = null;
}

export function emitTelemetry(event: TelemetryEvent): void {
  if (process.env.NODE_ENV === "development") {
    validateEvent(event);
  }

  try {
    emitFn?.(event);
  } catch {
    // Telemetry must never break the app
  }
}

// ── Factory helpers ──────────────────────────────────────────────────────────

export function createOutageEvent(
  action: OutageAction,
  route: string,
  meta?: { outageId?: string; severity?: string },
): OutageEvent {
  return {
    action,
    category: "outage",
    timestamp: Date.now(),
    route,
    ...meta,
  };
}

export function createPaymentEvent(
  action: PaymentAction,
  route: string,
  meta?: { paymentId?: string; amount?: number },
): PaymentEvent {
  return {
    action,
    category: "payment",
    timestamp: Date.now(),
    route,
    ...meta,
  };
}

export function createWebhookEvent(
  action: WebhookAction,
  route: string,
  meta?: { webhookId?: string; url?: string },
): WebhookEvent {
  return {
    action,
    category: "webhook",
    timestamp: Date.now(),
    route,
    ...meta,
  };
}

export function createAuthEvent(
  action: AuthAction,
  route: string,
  meta?: { userId?: string },
): AuthEvent {
  return {
    action,
    category: "auth",
    timestamp: Date.now(),
    route,
    ...meta,
  };
}
