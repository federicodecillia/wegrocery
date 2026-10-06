import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { recordMembershipCheck } from "./members";
import { orderMembershipOutcome, shouldRecheckMembershipOnOrder } from "./policy";
import { checkMembershipAny } from "./wallyfor";

type OrderingMember = Parameters<typeof shouldRecheckMembershipOnOrder>[0] & {
  memberId: string;
  email: string;
  aliasEmail: string | null;
};

// The membership card check of an order that goes up, shared by saveOrder
// and startOrderPayment: rechecked at most every 24h (a lapsed result is
// always rechecked). An unreachable API lets the order through: they were
// members at sign-in. false = the card is not valid, refuse the order.
// A family's account passes with any card of its people (members.household_of).
export async function membershipAllowsOrder(
  member: OrderingMember,
  checkEnabled: boolean,
  now: Date,
  raisesOrder: boolean,
  scope: string,
): Promise<boolean> {
  if (!shouldRecheckMembershipOnOrder(member, checkEnabled, now, raisesOrder)) return true;
  const people = await getDb()
    .select({ email: members.email, aliasEmail: members.aliasEmail })
    .from(members)
    .where(eq(members.householdOf, member.memberId));
  const result = await checkMembershipAny([
    member.email,
    member.aliasEmail,
    ...people.flatMap((p) => [p.email, p.aliasEmail]),
  ]);
  const outcome = orderMembershipOutcome(result);
  if (result.status === "error") {
    console.error(`[${scope}] membership check unavailable: ${result.message}`);
  }
  if (outcome.record) {
    try {
      await recordMembershipCheck(member.memberId, outcome.record, now);
    } catch (err) {
      console.error(`[${scope}] could not record membership check`, err);
    }
  }
  return outcome.allow;
}
