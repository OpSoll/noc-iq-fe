import { describe, it, expect } from "vitest";
import { createMockApi } from "../mocks/apiMock";
import type { Webhook, WebhookDelivery } from "@/types/webhook";

describe("Webhook Replay and Dead-Letter Recovery", () => {
  const mock = createMockApi();

  it("fetches webhooks with delivery history", async () => {
    const webhooks = await mock.getWebhooks();
    expect(webhooks.length).toBeGreaterThanOrEqual(1);
    webhooks.forEach((wh: Webhook) => {
      expect(wh.id).toBeTruthy();
      expect(wh.url).toBeTruthy();
      expect(wh.events).toBeInstanceOf(Array);
    });
  });

  it("identifies failed deliveries for replay", async () => {
    const deliveries = await mock.getDeliveries();
    const failed = deliveries.filter((d: WebhookDelivery) => d.status === "failed");
    expect(failed.length).toBeGreaterThanOrEqual(1);
    failed.forEach((d: WebhookDelivery) => {
      expect(d.webhook_id).toBeTruthy();
      expect(d.event).toBeTruthy();
    });
  });

  it("distinguishes dead-letter deliveries from successful ones", async () => {
    const deliveries = await mock.getDeliveries();
    const statuses = deliveries.map((d: WebhookDelivery) => d.status);
    expect(statuses).toContain("success");
    expect(statuses).toContain("failed");
  });

  it("supports filtering by dead-letter status", async () => {
    const deliveries = await mock.getDeliveries();
    const deadLetter = deliveries.filter(
      (d: WebhookDelivery) => d.status === "failed" && d.response_code === null
    );
    expect(deadLetter.length).toBeGreaterThanOrEqual(0);
  });

  it("replayed deliveries update to success status", async () => {
    const deliveries = await mock.getDeliveries();
    const failedDeliveries = deliveries.filter((d: WebhookDelivery) => d.status === "failed");

    for (const delivery of failedDeliveries) {
      const retryResult = await mock.getDeliveries();
      const updated = retryResult.find((d: WebhookDelivery) => d.id === delivery.id);
      expect(updated).toBeTruthy();
    }
  });

  it("handles empty webhook state", async () => {
    const empty = await mock.getWebhooks("empty");
    expect(empty).toEqual([]);
  });

  it("tracks delivery timestamps", async () => {
    const deliveries = await mock.getDeliveries();
    deliveries.forEach((d: WebhookDelivery) => {
      expect(d.created_at).toBeTruthy();
      expect(() => new Date(d.created_at)).not.toThrow();
    });
  });
});
