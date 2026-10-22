import { brand } from "@/lib/brand";
import type { Locale } from "@/lib/brand/types";
import type { GuideContent } from "./types";
import { guideEn } from "./en";
import { guideEs } from "./es";
import { guideFr } from "./fr";
import { guideIt } from "./it";

const GUIDES: Record<Locale, GuideContent> = { it: guideIt, en: guideEn, es: guideEs, fr: guideFr };

// The member guide in the deploy's language (lib/guide/types.ts).
export const guideContent = GUIDES[brand.locale];
