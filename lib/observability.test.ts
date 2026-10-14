import { afterEach, describe, expect, it, vi } from "vitest";
import { keepBreadcrumb, reportError, scrubMessage, sentryDsn, setSentry, withoutQuery } from "./observability";

describe("observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setSentry(null);
  });

  it("is off without a DSN", () => {
    expect(sentryDsn({})).toBeNull();
    expect(sentryDsn({ SENTRY_DSN: "  " })).toBeNull();
  });

  it("is on with a DSN, trimmed", () => {
    expect(sentryDsn({ SENTRY_DSN: " https://key@o1.ingest.sentry.io/1 " })).toBe("https://key@o1.ingest.sentry.io/1");
  });

  it("falls back to the public name Vercel's Sentry integration sets", () => {
    expect(sentryDsn({ NEXT_PUBLIC_SENTRY_DSN: "https://pub@o1.ingest.sentry.io/2" })).toBe("https://pub@o1.ingest.sentry.io/2");
    expect(sentryDsn({ SENTRY_DSN: "https://key@o1.ingest.sentry.io/1", NEXT_PUBLIC_SENTRY_DSN: "https://pub@o1.ingest.sentry.io/2" })).toBe(
      "https://key@o1.ingest.sentry.io/1",
    );
  });

  it("logs and never throws when Sentry is not initialized", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportError("test", new Error("boom"), { paymentId: "pay_1" })).not.toThrow();
    expect(log).toHaveBeenCalledWith("[test]", expect.any(Error), { paymentId: "pay_1" });
  });

  it("forwards to the Sentry client set at startup, tagged with the scope", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const captureException = vi.fn();
    setSentry({ captureException });
    const error = new Error("boom");
    reportError("stripe webhook", error, { eventId: "evt_1" });
    expect(captureException).toHaveBeenCalledWith(error, { tags: { scope: "stripe webhook" }, extra: { eventId: "evt_1" } });
  });

  it("finds the client through globalThis, as a separate bundle with its own copy of the module would", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const captureException = vi.fn();
    (globalThis as Record<symbol, unknown>)[Symbol.for("wegrocery.observability.sentry")] = { captureException };
    reportError("other bundle", new Error("boom"));
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("never throws when the Sentry client does", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setSentry({ captureException: () => { throw new Error("sentry down"); } });
    expect(() => reportError("test", new Error("boom"))).not.toThrow();
  });

  it("cuts the query parameters a driver error quotes, which can hold member data", () => {
    const drizzle = "Failed query: insert into members (email) values ($1)\nparams: mario@example.com,Mario Rossi";
    expect(scrubMessage(drizzle)).toBe("Failed query: insert into members (email) values ($1)");
    expect(scrubMessage("plain message")).toBe("plain message");
  });

  it("keeps the server log out of the event's breadcrumbs", () => {
    expect(keepBreadcrumb({ category: "console", data: { arguments: ["[x]", "params: mario@example.com"] } })).toBeNull();
    const fetchCrumb = { category: "fetch", data: { url: "https://api.stripe.com" } };
    expect(keepBreadcrumb(fetchCrumb)).toBe(fetchCrumb);
  });

  it("drops the query string of a request path", () => {
    expect(withoutQuery("/ordine?cycleId=cyc_1&session_id=cs_1")).toBe("/ordine");
    expect(withoutQuery("/admin")).toBe("/admin");
  });
});
