import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it("opens login, intake and cron only", () => {
    for (const p of ["/login", "/richiesta", "/richiesta/grazie", "/api/cron/refresh"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/", "/istanze/ins_1", "/nuovo", "/richieste", "/api/export", "/richiestaX", "/login/x"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
