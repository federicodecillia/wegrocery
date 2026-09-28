import { describe, expect, it, vi } from "vitest";
import {
  checkMembership,
  checkMembershipAny,
  getWallyForConfig,
  parseWallyForResponse,
  type MembershipResult,
} from "./wallyfor";

const config = { apiKey: "secret-key-123", merchantId: "5082" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getWallyForConfig", () => {
  it("returns null when either variable is missing or blank", () => {
    expect(getWallyForConfig({})).toBeNull();
    expect(getWallyForConfig({ WALLYFOR_API_KEY: "k" })).toBeNull();
    expect(getWallyForConfig({ WALLYFOR_MERCHANT_ID: "5082" })).toBeNull();
    expect(getWallyForConfig({ WALLYFOR_API_KEY: " ", WALLYFOR_MERCHANT_ID: "5082" })).toBeNull();
  });

  it("returns trimmed values when both are set", () => {
    expect(getWallyForConfig({ WALLYFOR_API_KEY: " k ", WALLYFOR_MERCHANT_ID: " 5082 " })).toEqual({
      apiKey: "k",
      merchantId: "5082",
    });
  });
});

describe("parseWallyForResponse", () => {
  it("maps OK to valid", () => {
    expect(parseWallyForResponse({ status: "OK", message: "Tessera valida" })).toEqual({ status: "valid" });
  });

  it("maps KO to invalid with the message", () => {
    expect(parseWallyForResponse({ status: "KO", message: "Data scaduta" })).toEqual({
      status: "invalid",
      message: "Data scaduta",
    });
  });

  it("treats a KO about credentials as a service error, not a lapsed membership", () => {
    const r = parseWallyForResponse({ status: "KO", message: "API key non valida" });
    expect(r.status).toBe("error");
  });

  it("maps unexpected shapes to error", () => {
    expect(parseWallyForResponse(null).status).toBe("error");
    expect(parseWallyForResponse({ status: "MAYBE" }).status).toBe("error");
    expect(parseWallyForResponse("OK").status).toBe("error");
  });
});

describe("checkMembership", () => {
  it("posts form-encoded email, api_key and ID", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: "OK", message: "ok" }));
    const r = await checkMembership(" Mario@Example.org ", { config, fetchImpl });
    expect(r).toEqual({ status: "valid" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://wallyfor.com/auto/api/1_0/check_validity.php");
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("email")).toBe("mario@example.org");
    expect(body.get("api_key")).toBe("secret-key-123");
    expect(body.get("ID")).toBe("5082");
    expect(init.signal).toBeDefined();
  });

  it("returns invalid on KO", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: "KO", message: "Data scaduta" }));
    expect(await checkMembership("a@b.it", { config, fetchImpl })).toEqual({
      status: "invalid",
      message: "Data scaduta",
    });
  });

  it("returns error on HTTP failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    expect((await checkMembership("a@b.it", { config, fetchImpl })).status).toBe("error");
  });

  it("returns error on non-JSON body", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect((await checkMembership("a@b.it", { config, fetchImpl })).status).toBe("error");
  });

  it("returns error on network failure or timeout, without leaking the api key", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const r = await checkMembership("a@b.it", { config, fetchImpl });
    expect(r.status).toBe("error");
    expect(JSON.stringify(r)).not.toContain("secret-key-123");
  });

  it("returns error when not configured, without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const r = await checkMembership("a@b.it", { config: null, fetchImpl });
    expect(r.status).toBe("error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns invalid without calling fetch for an empty email", async () => {
    const fetchImpl = vi.fn();
    expect((await checkMembership("  ", { config, fetchImpl })).status).toBe("invalid");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("checkMembershipAny", () => {
  function fake(results: Record<string, MembershipResult>) {
    return vi.fn(async (email: string) => results[email] ?? { status: "invalid" as const, message: "?" });
  }

  it("stops at the first valid email", async () => {
    const check = fake({ "a@x.it": { status: "valid" } });
    expect(await checkMembershipAny(["a@x.it", "b@x.it"], check)).toEqual({ status: "valid" });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("falls back to the alias when the primary is KO", async () => {
    const check = fake({
      "a@x.it": { status: "invalid", message: "Data scaduta" },
      "b@x.it": { status: "valid" },
    });
    expect(await checkMembershipAny(["a@x.it", "b@x.it"], check)).toEqual({ status: "valid" });
  });

  it("returns error when nothing is valid and at least one check errored", async () => {
    const check = fake({
      "a@x.it": { status: "invalid", message: "Data scaduta" },
      "b@x.it": { status: "error", message: "timeout" },
    });
    expect((await checkMembershipAny(["a@x.it", "b@x.it"], check)).status).toBe("error");
  });

  it("returns the first invalid when every check is invalid", async () => {
    const check = fake({
      "a@x.it": { status: "invalid", message: "Data scaduta" },
      "b@x.it": { status: "invalid", message: "Non trovato" },
    });
    expect(await checkMembershipAny(["a@x.it", "b@x.it"], check)).toEqual({
      status: "invalid",
      message: "Data scaduta",
    });
  });

  it("skips blanks and duplicates (case-insensitive)", async () => {
    const check = fake({});
    await checkMembershipAny(["A@x.it", null, "", "a@x.it"], check);
    expect(check).toHaveBeenCalledTimes(1);
  });
});
