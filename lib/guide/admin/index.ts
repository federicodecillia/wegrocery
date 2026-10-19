import { checkAccess, type SessionUser } from "@/lib/auth/access";
import { brand } from "@/lib/brand";
import type { GuideContent } from "../types";
import { adminGuideEn } from "./en";
import { adminGuideIt } from "./it";

// The admin guide (/guida/admin) in the deploy's language, handed out only
// to an active admin: anyone else gets null, so a page cannot show or index
// it by forgetting a role check. Server only (lib/guide/admin/admin-guide.test.ts).
export function adminGuideFor(user: SessionUser): GuideContent | null {
  if (!checkAccess(user, "admin").ok) return null;
  return brand.locale === "it" ? adminGuideIt : adminGuideEn;
}
