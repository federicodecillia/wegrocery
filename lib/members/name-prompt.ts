import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { NAME_LATER_COOKIE, nameNeedsCompleting, type NamePromptMode } from "./name";

/**
 * Whether AppShell shows the name prompt instead of the page, and how:
 * "required" (no way past it), "optional" ("Più tardi" is offered), or null.
 * The person who signed in, never the family account they work on.
 */
export async function namePromptFor(personId: string): Promise<Exclude<NamePromptMode, "off"> | null> {
  const settings = await getPaymentSettings();
  const mode = settings.memberNamePrompt;
  if (mode === "off") return null;
  if (mode === "optional" && (await cookies()).get(NAME_LATER_COOKIE)) return null;
  const [person] = await getDb()
    .select({ fullName: members.fullName, email: members.email, aliasEmail: members.aliasEmail })
    .from(members)
    .where(eq(members.memberId, personId))
    .limit(1);
  if (!person || !nameNeedsCompleting(person.fullName, [person.email, person.aliasEmail])) return null;
  return mode;
}
