import { describe, it, expect } from "vitest";
import { redactObject, redactJson, REDACTED_PLACEHOLDER } from "./redaction";

describe("redactObject", () => {
  it("masks known sensitive keys", () => {
    const result = redactObject({ password: "secret123", name: "Alice" }) as Record<string, unknown>;
    expect(result.password).toBe(REDACTED_PLACEHOLDER);
    expect(result.name).toBe("Alice");
  });

  it("masks keys case-insensitively", () => {
    const result = redactObject({ API_KEY: "key", Token: "tok" }) as Record<string, unknown>;
    expect(result.API_KEY).toBe(REDACTED_PLACEHOLDER);
    expect(result.Token).toBe(REDACTED_PLACEHOLDER);
  });

  it("redacts nested sensitive fields", () => {
    const result = redactObject({ user: { token: "abc", role: "admin" } }) as Record<string, unknown>;
    const user = result.user as Record<string, unknown>;
    expect(user.token).toBe(REDACTED_PLACEHOLDER);
    expect(user.role).toBe("admin");
  });

  it("handles arrays", () => {
    const result = redactObject([{ secret: "x" }, { safe: "y" }]) as Array<Record<string, unknown>>;
    expect(result[0].secret).toBe(REDACTED_PLACEHOLDER);
    expect(result[1].safe).toBe("y");
  });

  it("returns primitives unchanged", () => {
    expect(redactObject(42)).toBe(42);
    expect(redactObject("hello")).toBe("hello");
    expect(redactObject(null)).toBe(null);
  });
});

describe("redactJson", () => {
  it("redacts sensitive fields in a JSON string", () => {
    const json = JSON.stringify({ authorization: "Bearer xyz", user: "bob" });
    const result = JSON.parse(redactJson(json));
    expect(result.authorization).toBe(REDACTED_PLACEHOLDER);
    expect(result.user).toBe("bob");
  });

  it("returns original string if not valid JSON", () => {
    const raw = "not json at all";
    expect(redactJson(raw)).toBe(raw);
  });
});
