import { checkAccess, type SessionUser } from "@/lib/auth/access";
import { brand } from "@/lib/brand";
import type { Locale } from "@/lib/brand/types";
import type { GuideContent } from "../types";
import { adminGuideEn } from "./en";
import { adminGuideEs } from "./es";
import { adminGuideFr } from "./fr";
import { adminGuideIt } from "./it";

const ADMIN_GUIDES: Record<Locale, GuideContent> = {
  it: adminGuideIt,
  en: adminGuideEn,
  es: adminGuideEs,
  fr: adminGuideFr,
};

// The admin guide (/guida/admin) in the deploy's language, handed out only
// to an active admin: anyone else gets null, so a page cannot show or index
// it by forgetting a role check. Server only (lib/guide/admin/admin-guide.test.ts).
export function adminGuideFor(user: SessionUser): GuideContent | null {
  if (!checkAccess(user, "admin").ok) return null;
  return ADMIN_GUIDES[brand.locale];
}
