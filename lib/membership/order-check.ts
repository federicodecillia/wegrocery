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
export async function membershipAllowsOrder(
  member: OrderingMember,
  checkEnabled: boolean,
  now: Date,
  raisesOrder: boolean,
  scope: string,
): Promise<boolean> {
  if (!shouldRecheckMembershipOnOrder(member, checkEnabled, now, raisesOrder)) return true;
  const result = await checkMembershipAny([member.email, member.aliasEmail]);
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
