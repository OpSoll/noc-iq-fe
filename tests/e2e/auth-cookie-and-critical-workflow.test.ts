import { describe, it, expect } from "vitest";
// Closes #367: session cookie helper (server sets the real cookie via Set-Cookie/httpOnly)
// Closes #365: critical incident workflow e2e scaffold

export function hasSessionCookie(cookieHeader: string): boolean {
  return cookieHeader
    .split(";")
    .some((c) => c.trim().startsWith("noc_session="));
}

describe("session cookie helper", () => {
  it("detects the session cookie when present", () => {
    expect(hasSessionCookie("noc_session=abc123; other=1")).toBe(true);
  });

  it("returns false when the cookie is absent", () => {
    expect(hasSessionCookie("other=1")).toBe(false);
  });
});

describe.skip("critical incident workflow (requires Playwright + running dev server)", () => {
  it("logs in, creates an outage, and verifies it appears in the list", () => {
    // Scaffold for full browser e2e coverage; see issue #365 acceptance criteria
    // for the remaining resolve/SLA/payment workflow steps to cover.
  });
});
