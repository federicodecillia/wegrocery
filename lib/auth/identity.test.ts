import { describe, expect, it } from "vitest";
import { oauthIdentityRefusal } from "./identity";

describe("oauthIdentityRefusal", () => {
  it("refuses a Google identity whose address Google has not verified, member or not", () => {
    expect(oauthIdentityRefusal({ emailVerified: false }, { method: "oauth" })).toEqual({ error: "AccessDenied" });
    expect(oauthIdentityRefusal({}, { method: "oauth" })).toEqual({ error: "AccessDenied" });
  });

  it("lets a verified Google identity and every other method through to the member check", () => {
    expect(oauthIdentityRefusal({ emailVerified: true }, { method: "oauth" })).toBeNull();
    expect(oauthIdentityRefusal({ emailVerified: false }, { method: "magic-link" })).toBeNull();
  });
});
