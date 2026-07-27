import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateEvent,
  EventValidationError,
  emitTelemetry,
  setEmitFn,
  resetEmitFn,
  createOutageEvent,
  createPaymentEvent,
  createWebhookEvent,
  createAuthEvent,
} from "@/lib/telemetry/events";

describe("event taxonomy", () => {
  beforeEach(() => {
    resetEmitFn();
  });

  describe("validateEvent", () => {
    it("accepts a valid outage event", () => {
      const event = createOutageEvent("create", "/outages");
      expect(validateEvent(event)).toBe(true);
    });

    it("accepts a valid payment event", () => {
      const event = createPaymentEvent("process", "/payments");
      expect(validateEvent(event)).toBe(true);
    });

    it("accepts a valid webhook event", () => {
      const event = createWebhookEvent("create", "/webhooks");
      expect(validateEvent(event)).toBe(true);
    });

    it("accepts a valid auth event", () => {
      const event = createAuthEvent("login", "/login");
      expect(validateEvent(event)).toBe(true);
    });

    it("rejects non-object", () => {
      expect(() => validateEvent(null)).toThrow(EventValidationError);
    });

    it("rejects missing action", () => {
      expect(() => validateEvent({ category: "outage", timestamp: 1, route: "/" })).toThrow("string 'action'");
    });

    it("rejects invalid category", () => {
      expect(() => validateEvent({ action: "create", category: "unknown", timestamp: 1, route: "/" })).toThrow("Invalid category");
    });

    it("rejects invalid action for category", () => {
      expect(() => validateEvent({ action: "login", category: "outage", timestamp: 1, route: "/" })).toThrow("Invalid action");
    });

    it("rejects non-numeric timestamp", () => {
      expect(() => validateEvent({ action: "create", category: "outage", timestamp: "now", route: "/" })).toThrow("numeric 'timestamp'");
    });

    it("rejects non-string route", () => {
      expect(() => validateEvent({ action: "create", category: "outage", timestamp: 1, route: 123 })).toThrow("string 'route'");
    });
  });

  describe("emitTelemetry", () => {
    it("calls the emit function", () => {
      const fn = vi.fn();
      setEmitFn(fn);
      const event = createOutageEvent("create", "/outages");
      emitTelemetry(event);
      expect(fn).toHaveBeenCalledWith(event);
    });

    it("silently catches emit errors", () => {
      setEmitFn(() => {
        throw new Error("boom");
      });
      expect(() => emitTelemetry(createAuthEvent("login", "/"))).not.toThrow();
    });
  });

  describe("factory helpers", () => {
    it("creates outage event with defaults", () => {
      const e = createOutageEvent("resolve", "/outages/1", { outageId: "1", severity: "high" });
      expect(e.category).toBe("outage");
      expect(e.action).toBe("resolve");
      expect(e.route).toBe("/outages/1");
      expect(e.outageId).toBe("1");
      expect(e.severity).toBe("high");
      expect(typeof e.timestamp).toBe("number");
    });

    it("creates payment event", () => {
      const e = createPaymentEvent("refund", "/payments/2", { paymentId: "2", amount: 100 });
      expect(e.category).toBe("payment");
      expect(e.action).toBe("refund");
      expect(e.amount).toBe(100);
    });

    it("creates webhook event", () => {
      const e = createWebhookEvent("delete", "/webhooks/3", { webhookId: "3" });
      expect(e.category).toBe("webhook");
      expect(e.action).toBe("delete");
      expect(e.webhookId).toBe("3");
    });

    it("creates auth event", () => {
      const e = createAuthEvent("logout", "/logout", { userId: "u1" });
      expect(e.category).toBe("auth");
      expect(e.action).toBe("logout");
      expect(e.userId).toBe("u1");
    });
  });
});
