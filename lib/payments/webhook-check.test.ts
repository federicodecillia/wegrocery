import { describe, expect, it } from "vitest";
import { checkWebhookEndpoints } from "./webhook-check";

const url = "https://gas.example.org/api/stripe/webhook";
const all = ["a", "b"];

describe("checkWebhookEndpoints", () => {
  it("finds the app's endpoint with every event", () => {
    expect(checkWebhookEndpoints([{ url, status: "enabled", enabled_events: all }], url, all)).toEqual({ status: "ok" });
  });

  it("ignores the query string and a trailing slash", () => {
    const e = { url: `${url}/?x-vercel-protection-bypass=s`, status: "enabled", enabled_events: ["*"] };
    expect(checkWebhookEndpoints([e], url, all)).toEqual({ status: "ok" });
  });

  it("says what is missing", () => {
    expect(checkWebhookEndpoints([], url, all)).toEqual({ status: "missingEndpoint" });
    expect(checkWebhookEndpoints([{ url: "https://other.org/api/stripe/webhook", status: "enabled", enabled_events: all }], url, all)).toEqual({
      status: "missingEndpoint",
    });
    expect(checkWebhookEndpoints([{ url, status: "disabled", enabled_events: all }], url, all)).toEqual({ status: "disabled" });
    expect(checkWebhookEndpoints([{ url, status: "enabled", enabled_events: ["a"] }], url, all)).toEqual({
      status: "missingEvents",
      missing: ["b"],
    });
  });
});
