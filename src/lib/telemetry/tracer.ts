/**
 * src/lib/telemetry/tracer.ts
 *
 * Lightweight route-level span instrumentation.
 * Spans are in-memory traces with timing, attributes, and status — no external
 * OpenTelemetry SDK dependency. Controlled by NEXT_PUBLIC_OTEL_ENABLED env var.
 */

export interface Span {
  name: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  attributes: Record<string, string | number | boolean>;
  status: "ok" | "error" | "unset";
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string>;
}

export interface Tracer {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): SpanHandle;
}

export interface SpanHandle {
  span: Span;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, string>): void;
  setStatus(status: "ok" | "error"): void;
  end(): void;
}

// ── Singleton span store ─────────────────────────────────────────────────────

const activeSpans: Span[] = [];
const MAX_STORED_SPANS = 500;

function isEnabled(): boolean {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_OTEL_ENABLED === "true") {
    return true;
  }
  return false;
}

// ── In-memory correlation ID (propagated to API calls) ───────────────────────

let currentCorrelationId: string | null = null;

export function generateCorrelationId(): string {
  return `span-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

export function getCorrelationId(): string | null {
  return currentCorrelationId;
}

// ── Tracer implementation ────────────────────────────────────────────────────

function createSpan(name: string, attributes?: Record<string, string | number | boolean>): SpanHandle {
  const span: Span = {
    name,
    startTime: performance.now(),
    endTime: null,
    durationMs: null,
    attributes: { ...attributes },
    status: "unset",
    events: [],
  };

  const handle: SpanHandle = {
    span,
    setAttribute(key, value) {
      span.attributes[key] = value;
    },
    addEvent(name, attributes) {
      span.events.push({ name, timestamp: performance.now(), attributes });
    },
    setStatus(status) {
      span.status = status;
    },
    end() {
      span.endTime = performance.now();
      span.durationMs = span.endTime - span.startTime;
      activeSpans.push(span);
      if (activeSpans.length > MAX_STORED_SPANS) {
        activeSpans.shift();
      }
    },
  };

  return handle;
}

function createNoopTracer(): Tracer {
  const noopHandle: SpanHandle = {
    span: { name: "", startTime: 0, endTime: 0, durationMs: null, attributes: {}, status: "unset", events: [] },
    setAttribute() {},
    addEvent() {},
    setStatus() {},
    end() {},
  };

  return {
    startSpan() {
      return { ...noopHandle, span: { ...noopHandle.span } };
    },
  };
}

function createRealTracer(): Tracer {
  return {
    startSpan(name, attributes) {
      return createSpan(name, attributes);
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

let tracerInstance: Tracer | null = null;

export function getTracer(): Tracer {
  if (!tracerInstance) {
    tracerInstance = isEnabled() ? createRealTracer() : createNoopTracer();
  }
  return tracerInstance;
}

export function getCompletedSpans(): readonly Span[] {
  return [...activeSpans];
}

export function clearSpans(): void {
  activeSpans.length = 0;
}

/** Reset tracer instance (useful for tests) */
export function resetTracer(): void {
  tracerInstance = null;
  activeSpans.length = 0;
  currentCorrelationId = null;
}

// ── Convenience wrappers for common route instrumentation ────────────────────

export function instrumentLoad<T>(routeName: string, fn: () => Promise<T>): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(`${routeName}.load`, { "span.kind": "client" });
  span.addEvent("load.start");
  return fn()
    .then((result) => {
      span.setStatus("ok");
      span.addEvent("load.end");
      span.end();
      return result;
    })
    .catch((err) => {
      span.setStatus("error");
      span.addEvent("load.error");
      span.end();
      throw err;
    });
}

export function instrumentMutate<T>(routeName: string, fn: () => Promise<T>): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(`${routeName}.mutate`, { "span.kind": "client" });
  span.addEvent("mutate.start");
  return fn()
    .then((result) => {
      span.setStatus("ok");
      span.addEvent("mutate.end");
      span.end();
      return result;
    })
    .catch((err) => {
      span.setStatus("error");
      span.addEvent("mutate.error");
      span.end();
      throw err;
    });
}
