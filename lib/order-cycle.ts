// Which open cycle /ordine shows. A requested cycleId wins while the member
// can still order in it. Otherwise a single open cycle opens directly, and
// with several the member picks one: silently opening the first one sent
// members to the wrong order.
export type OrderCycleChoice<C> =
  | { kind: "none" }
  | { kind: "open"; cycle: C }
  | { kind: "choose" };

export function resolveOrderCycle<C extends { cycleId: string }>(
  cycles: ReadonlyArray<C>,
  requestedId: string | undefined,
): OrderCycleChoice<C> {
  const requested = requestedId ? cycles.find((c) => c.cycleId === requestedId) : undefined;
  if (requested) return { kind: "open", cycle: requested };
  if (cycles.length === 0) return { kind: "none" };
  if (cycles.length === 1) return { kind: "open", cycle: cycles[0] };
  return { kind: "choose" };
}
