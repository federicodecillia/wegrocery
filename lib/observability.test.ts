import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError, sentryDsn } from "./observability";

describe("observability", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is off without a DSN", () => {
    expect(sentryDsn({})).toBeNull();
    expect(sentryDsn({ SENTRY_DSN: "  " })).toBeNull();
  });

  it("is on with a DSN, trimmed", () => {
    expect(sentryDsn({ SENTRY_DSN: " https://key@o1.ingest.sentry.io/1 " })).toBe("https://key@o1.ingest.sentry.io/1");
  });

  it("logs and never throws when Sentry is not initialized", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportError("test", new Error("boom"), { paymentId: "pay_1" })).not.toThrow();
    expect(log).toHaveBeenCalledWith("[test]", expect.any(Error), { paymentId: "pay_1" });
  });
});
