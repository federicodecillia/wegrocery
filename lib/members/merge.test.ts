import { describe, expect, it } from "vitest";
import { aliasOptions, mergedPlaceholderEmail, planMemberMerge, type MergeState } from "./merge";

function state(over: Partial<MergeState> = {}): MergeState {
  return {
    survivor: {
      memberId: "mem_a",
      fullName: "Anna Rossi",
      email: "anna@group.example",
      aliasEmail: null,
      active: true,
      mergedInto: null,
      householdOf: null,
    },
    absorbed: {
      memberId: "mem_b",
      fullName: "Anna Rossi",
      email: "Anna.Rossi@Mail.example",
      aliasEmail: null,
      active: true,
      mergedInto: null,
      householdOf: null,
    },
    actingMemberId: "mem_admin",
    absorbedOrderCycles: [],
    survivorOpenOrderCycleIds: [],
    absorbedBalanceCents: 0,
    absorbedLedgerRows: 0,
    absorbedPayments: 0,
    absorbedPendingPayments: 0,
    absorbedOpenRefunds: 0,
    absorbedUnsettledPerOrderCycles: 0,
    absorbedHouseholdMembers: 0,
    ...over,
  };
}

const openWallet = { cycleId: "cyc_1", title: "Week 40", status: "open", paymentMode: "wallet" };

describe("planMemberMerge", () => {
  it("deletes an absorbed account with nothing but open-cycle orders, and its address becomes the alias", () => {
    const d = planMemberMerge(state({ absorbedOrderCycles: [openWallet] }));
    expect(d).toEqual({
      ok: true,
      plan: {
        moveCycleIds: ["cyc_1"],
        transferCents: 0,
        deleteAbsorbed: true,
        survivorEmail: "anna@group.example",
        survivorAlias: "anna.rossi@mail.example",
        droppedAddresses: [],
      },
    });
  });

  it("keeps an absorbed account with history and moves its balance", () => {
    const d = planMemberMerge(
      state({
        absorbedOrderCycles: [{ ...openWallet, cycleId: "cyc_0", status: "closed" }],
        absorbedLedgerRows: 2,
        absorbedBalanceCents: -1250,
      }),
    );
    expect(d.ok && d.plan).toMatchObject({ moveCycleIds: [], transferCents: -1250, deleteAbsorbed: false });
  });

  it("keeps an absorbed account with payments even without movements", () => {
    const d = planMemberMerge(state({ absorbedPayments: 1 }));
    expect(d.ok && d.plan.deleteAbsorbed).toBe(false);
  });

  it("lets the admin pick the alias when the survivor already has one, dropping the others", () => {
    const s = state({
      survivor: { ...state().survivor, aliasEmail: "old@alias.example" },
      absorbed: { ...state().absorbed, aliasEmail: "third@alias.example" },
    });
    expect(aliasOptions(s.survivor, s.absorbed)).toEqual([
      "anna.rossi@mail.example",
      "old@alias.example",
      "third@alias.example",
    ]);
    const d = planMemberMerge(s, "OLD@alias.example");
    expect(d.ok && d.plan).toMatchObject({
      survivorAlias: "old@alias.example",
      droppedAddresses: ["anna.rossi@mail.example", "third@alias.example"],
    });
    expect(planMemberMerge(s, "someone@else.example")).toEqual({ ok: false, refusal: { code: "alias_not_offered" } });
  });

  it("can leave the alias empty, dropping every other address", () => {
    const d = planMemberMerge(state(), null);
    expect(d.ok && d.plan).toMatchObject({ survivorAlias: null, droppedAddresses: ["anna.rossi@mail.example"] });
  });

  it.each([
    ["same_member", state({ absorbed: { ...state().survivor } })],
    ["already_merged", state({ absorbed: { ...state().absorbed, mergedInto: "mem_x" } })],
    ["already_merged", state({ survivor: { ...state().survivor, mergedInto: "mem_x" } })],
    ["survivor_inactive", state({ survivor: { ...state().survivor, active: false } })],
    ["absorbing_self", state({ actingMemberId: "mem_b" })],
    ["both_ordered", state({ absorbedOrderCycles: [openWallet], survivorOpenOrderCycleIds: ["cyc_1"] })],
    ["per_order_open", state({ absorbedOrderCycles: [{ ...openWallet, paymentMode: "per_order" }] })],
    ["pending_payment", state({ absorbedPayments: 1, absorbedPendingPayments: 1 })],
    ["open_refund", state({ absorbedOpenRefunds: 1 })],
    ["unsettled_per_order", state({ absorbedUnsettledPerOrderCycles: 1 })],
  ])("refuses: %s", (code, s) => {
    const d = planMemberMerge(s);
    expect(d.ok).toBe(false);
    expect(!d.ok && d.refusal.code).toBe(code);
  });

  it("does not care about orders the survivor has on other open cycles", () => {
    const d = planMemberMerge(state({ absorbedOrderCycles: [openWallet], survivorOpenOrderCycleIds: ["cyc_2"] }));
    expect(d.ok).toBe(true);
  });

  it("allows absorbing an inactive account", () => {
    const d = planMemberMerge(state({ absorbed: { ...state().absorbed, active: false } }));
    expect(d.ok).toBe(true);
  });
});

describe("mergedPlaceholderEmail", () => {
  it("is unique per member and undeliverable", () => {
    expect(mergedPlaceholderEmail("mem_AB12")).toBe("mem_ab12@merged.invalid");
  });
});

describe("planMemberMerge with families", () => {
  const base = state();
  it("refuses to merge an account other people joined", () => {
    expect(planMemberMerge(state({ absorbedHouseholdMembers: 1 }))).toEqual({
      ok: false,
      refusal: { code: "has_family", fullName: "Anna Rossi" },
    });
  });

  it("refuses to merge a person who joined a family", () => {
    const d = planMemberMerge(state({ absorbed: { ...base.absorbed, householdOf: "mem_x" } }));
    expect(d).toEqual({ ok: false, refusal: { code: "in_family", fullName: "Anna Rossi" } });
  });

  it("links without touching addresses, keeping the person and moving balance and open orders", () => {
    const d = planMemberMerge(
      state({
        absorbedOrderCycles: [openWallet, { ...openWallet, cycleId: "cyc_0", status: "closed" }],
        absorbedBalanceCents: 1250,
        absorbedLedgerRows: 3,
      }),
      undefined,
      "link",
    );
    expect(d).toEqual({
      ok: true,
      plan: {
        moveCycleIds: ["cyc_1"],
        transferCents: 1250,
        deleteAbsorbed: false,
        survivorEmail: "anna@group.example",
        survivorAlias: null,
        droppedAddresses: [],
      },
    });
  });

  it("lets the invited member link themselves (no absorbing_self in link mode)", () => {
    const d = planMemberMerge(state({ actingMemberId: "mem_b" }), undefined, "link");
    expect(d.ok).toBe(true);
  });

  it("keeps the merge refusals when linking", () => {
    const d = planMemberMerge(
      state({ absorbedOrderCycles: [openWallet], survivorOpenOrderCycleIds: ["cyc_1"] }),
      undefined,
      "link",
    );
    expect(d).toEqual({ ok: false, refusal: { code: "both_ordered", cycleTitle: "Week 40" } });
  });
});
