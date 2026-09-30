import { describe, expect, it } from "vitest";
import { isPublicAuthEndpoint } from "./public-endpoints";

describe("isPublicAuthEndpoint", () => {
  it("opens the email link and nothing else by default", () => {
    expect(isPublicAuthEndpoint("POST", "/api/auth/sign-in/magic-link", {})).toBe(true);
    expect(isPublicAuthEndpoint("GET", "/api/auth/magic-link/verify", {})).toBe(true);
    expect(isPublicAuthEndpoint("POST", "/api/auth/sign-in/social", {})).toBe(false);
    expect(isPublicAuthEndpoint("POST", "/api/auth/demo/sign-in", {})).toBe(false);
    expect(isPublicAuthEndpoint("GET", "/api/auth/list-sessions", {})).toBe(false);
    expect(isPublicAuthEndpoint("POST", "/api/auth/revoke-sessions", {})).toBe(false);
  });

  it("opens Google only with its variables, the demo only in demo mode, the dev login only locally", () => {
    const google = { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" };
    expect(isPublicAuthEndpoint("POST", "/api/auth/sign-in/social", google)).toBe(true);
    expect(isPublicAuthEndpoint("GET", "/api/auth/callback/google", google)).toBe(true);
    expect(isPublicAuthEndpoint("POST", "/api/auth/demo/sign-in", { DEMO_MODE: "true" })).toBe(true);
    expect(isPublicAuthEndpoint("POST", "/api/auth/dev/sign-in", { AUTH_DEV_LOGIN_EMAIL: "a@b.c" })).toBe(true);
    expect(
      isPublicAuthEndpoint("POST", "/api/auth/dev/sign-in", { AUTH_DEV_LOGIN_EMAIL: "a@b.c", NODE_ENV: "production" }),
    ).toBe(false);
  });
});
