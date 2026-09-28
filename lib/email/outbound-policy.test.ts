import { describe, expect, it } from "vitest";
import { resolveOutbound } from "./outbound-policy";

const BLOCKED = "blocked-outside-production";
const msg = { to: "member@example.org", cc: ["admin@example.org", "archive@example.org"], subject: "Ordine" };

describe("resolveOutbound", () => {
  it("sends unchanged in production", () => {
    expect(resolveOutbound(msg, { vercelEnv: "production", redirectTo: "qa@example.org" }, BLOCKED)).toEqual({
      action: "send",
      to: "member@example.org",
      cc: ["admin@example.org", "archive@example.org"],
      subject: "Ordine",
    });
  });

  it("redirects preview sends to EMAIL_REDIRECT_TO, drops cc and tags the subject", () => {
    expect(resolveOutbound(msg, { vercelEnv: "preview", redirectTo: "qa@example.org" }, BLOCKED)).toEqual({
      action: "send",
      to: "qa@example.org",
      cc: [],
      subject: "[STAGING -> member@example.org] Ordine",
    });
  });

  it("treats local dev (VERCEL_ENV unset) as non-production", () => {
    const d = resolveOutbound(msg, { vercelEnv: undefined, redirectTo: "qa@example.org" }, BLOCKED);
    expect(d).toMatchObject({ action: "send", to: "qa@example.org", cc: [] });
  });

  it("blocks non-production sends when no redirect is configured", () => {
    expect(resolveOutbound(msg, { vercelEnv: "preview" }, BLOCKED)).toEqual({ action: "block", error: BLOCKED });
    expect(resolveOutbound(msg, { vercelEnv: undefined, redirectTo: "" }, BLOCKED)).toEqual({
      action: "block",
      error: BLOCKED,
    });
  });

  it("treats a whitespace-only redirect as unset", () => {
    expect(resolveOutbound(msg, { vercelEnv: "development", redirectTo: "   " }, BLOCKED).action).toBe("block");
  });

  it("does not match production case-insensitively or by prefix", () => {
    expect(resolveOutbound(msg, { vercelEnv: "Production" }, BLOCKED).action).toBe("block");
    expect(resolveOutbound(msg, { vercelEnv: "production-like" }, BLOCKED).action).toBe("block");
  });

  it("accepts a message without cc", () => {
    expect(
      resolveOutbound({ to: "a@example.org", subject: "S" }, { vercelEnv: "production" }, BLOCKED),
    ).toEqual({ action: "send", to: "a@example.org", cc: [], subject: "S" });
  });
});
