import { brand } from "@/lib/brand";
import { guideEn } from "./en";
import { guideIt } from "./it";

// The member guide in the deploy's language (lib/guide/types.ts).
export const guideContent = brand.locale === "it" ? guideIt : guideEn;
