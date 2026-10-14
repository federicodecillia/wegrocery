import { describe, expect, it } from "vitest";
import { emailIdempotencyKey, minuteBucket } from "./idempotency";
import { signUnsubscribeToken, unsubscribeHeaders, unsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe";

const secret = "s".repeat(40);

describe("unsubscribe token", () => {
  it("round-trips a member and a category", () => {
    const token = signUnsubscribeToken("mem_abc.def", "order_charge", secret);
    expect(verifyUnsubscribeToken(token, secret)).toEqual({ memberId: "mem_abc.def", category: "order_charge" });
  });

  it("refuses a changed payload, a changed signature, another secret and garbage", () => {
    const token = signUnsubscribeToken("mem_1", "wallet_topup", secret);
    const [payload, signature] = token.split(".");
    const other = Buffer.from("mem_2.wallet_topup").toString("base64url");
    expect(verifyUnsubscribeToken(`${other}.${signature}`, secret)).toBeNull();
    expect(verifyUnsubscribeToken(`${payload}.${signature.slice(0, -2)}AA`, secret)).toBeNull();
    expect(verifyUnsubscribeToken(token, "t".repeat(40))).toBeNull();
    expect(verifyUnsubscribeToken(token, "")).toBeNull();
    for (const bad of ["", "x", "a.b.c", `${payload}.`, `.${signature}`]) expect(verifyUnsubscribeToken(bad, secret)).toBeNull();
  });

  it("refuses a validly signed token for a category that does not exist", () => {
    const payload = Buffer.from("mem_1.not_a_category").toString("base64url");
    const forged = `${payload}.${signUnsubscribeToken("mem_1", "order_charge", secret).split(".")[1]}`;
    expect(verifyUnsubscribeToken(forged, secret)).toBeNull();
  });
});

describe("unsubscribeHeaders", () => {
  it("gives the one-click pair, with a link that verifies", () => {
    const h = unsubscribeHeaders({ memberId: "mem_1", category: "cycle_opened" }, "https://app.example", secret)!;
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const url = new URL(h["List-Unsubscribe"].slice(1, -1));
    expect(url.origin + url.pathname).toBe("https://app.example/api/unsubscribe");
    expect(verifyUnsubscribeToken(url.searchParams.get("t")!, secret)).toEqual({ memberId: "mem_1", category: "cycle_opened" });
  });

  it("gives nothing without a category, a base URL or a secret", () => {
    expect(unsubscribeHeaders({ memberId: "m", category: null }, "https://a", secret)).toBeNull();
    expect(unsubscribeHeaders({ memberId: "m", category: "order_charge" }, null, secret)).toBeNull();
    expect(unsubscribeHeaders({ memberId: "m", category: "order_charge" }, "https://a", undefined)).toBeNull();
  });

  it("builds the URL from the base without a double slash", () => {
    expect(unsubscribeUrl("https://a.b", "x y")).toBe("https://a.b/api/unsubscribe?t=x%20y");
  });
});

describe("emailIdempotencyKey", () => {
  it("is the same for the same logical send and differs when any part does", () => {
    const at = new Date("2026-10-14T10:00:00Z");
    expect(emailIdempotencyKey("n", "id1", at)).toBe(emailIdempotencyKey("n", "id1", new Date(at)));
    expect(emailIdempotencyKey("n", "id1", at)).not.toBe(emailIdempotencyKey("n", "id2", at));
    expect(emailIdempotencyKey("n", "id1", at)).not.toBe(emailIdempotencyKey("n", "id1", new Date(at.getTime() + 1)));
    expect(emailIdempotencyKey("a", "bc")).not.toBe(emailIdempotencyKey("ab", "c"));
  });

  it("buckets by the minute, so a double click collapses and a later resend does not", () => {
    const t0 = new Date("2026-10-14T10:00:10Z");
    expect(minuteBucket(t0)).toBe(minuteBucket(new Date("2026-10-14T10:00:50Z")));
    expect(minuteBucket(t0)).not.toBe(minuteBucket(new Date("2026-10-14T10:01:10Z")));
  });
});
