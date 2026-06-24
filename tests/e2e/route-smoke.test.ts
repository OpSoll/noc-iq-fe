import { describe, it, expect } from "vitest";

const BASE = process.env.PREVIEW_URL || "http://localhost:3000";

async function fetchRoute(path: string): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(`${BASE}${path}`);
    return { status: res.status, text: await res.text() };
  } catch {
    return { status: 0, text: "Network error" };
  }
}

const ROUTES: { path: string; label: string }[] = [
  { path: "/login", label: "Auth — login" },
  { path: "/register", label: "Auth — register" },
  { path: "/", label: "Dashboard" },
  { path: "/outages", label: "Outages list" },
  { path: "/payments", label: "Payments" },
  { path: "/webhooks", label: "Webhooks" },
  { path: "/config", label: "SLA Config" },
  { path: "/bulk-import", label: "Bulk Import" },
];

describe("Preview route smoke tests", () => {
  for (const route of ROUTES) {
    it(`${route.label} (${route.path}) responds`, async () => {
      const { status } = await fetchRoute(route.path);
      expect([200, 302, 308]).toContain(status);
    });
  }
});
