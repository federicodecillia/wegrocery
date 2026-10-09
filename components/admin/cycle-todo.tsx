"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { adminHref } from "@/lib/admin/nav";
import { currentStep, doneKey, type CycleStep, type CycleTask } from "@/lib/admin/cycle-phase";
import type { CycleView } from "@/lib/admin/cycle-views";

const STORAGE_KEY = "wg.admin.todoDone";
/** Tasks shown: two on a phone or tablet (the cycle stays in view), three side by side from lg. */
const SHOWN = 3;
const SHOWN_SMALL = 2;

function readDone(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDone(done: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch {
    // Private mode or storage blocked: the step comes back on the next visit.
  }
}

const VIEW: Record<CycleStep, CycleView> = {
  overdue: "panoramica",
  open: "ordini",
  to_send: "fornitore",
  to_adjust: "ordini",
  to_settle: "conti",
};

// Admin → Ciclo, on top: the next step of each cycle that needs one (at most
// three on a computer, two on a phone, the most urgent first), then what waits elsewhere (refunds to retry
// in Cassa, possible duplicates in Soci). Replaces the three count tiles,
// which linked back to this page and never showed an open cycle past its
// deadline. "Già inviato" / "Consegnato come ordinato" are remembered on this
// device only: other admins still see the step.
export function CycleTodo({
  tasks,
  refunds,
  duplicates,
}: {
  tasks: CycleTask[];
  refunds: number;
  duplicates: number;
}) {
  const [done, setDone] = useState<Set<string>>(() => new Set());
  useEffect(() => setDone(readDone()), []);
  const d = t.admin.workspace.todo;

  const visible = tasks.flatMap((task) => {
    const step = currentStep(task, done);
    return step ? [{ task, step }] : [];
  });
  const shown = visible.slice(0, SHOWN);

  function markDone(cycleId: string, step: CycleStep) {
    const next = new Set(done);
    next.add(doneKey(cycleId, step));
    setDone(next);
    writeDone(next);
  }

  return (
    <section aria-labelledby="todo-title" className="mb-4 rounded-2xl border border-brand-border bg-white p-3 lg:p-4">
      <h2 id="todo-title" className="px-1 text-label font-bold uppercase tracking-wide text-muted">
        {d.title}
      </h2>
      {shown.length === 0 ? (
        <p className="px-1 pt-2 text-[13px] text-brand-gray">{d.nothing}</p>
      ) : (
        <ul className="mt-2 space-y-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
          {shown.map(({ task, step }, i) => (
            <li
              key={task.cycleId}
              className={`${i >= SHOWN_SMALL ? "hidden lg:flex" : "flex"} flex-col rounded-xl border p-3 ${
                step === "overdue" ? "border-brand-red/40 bg-brand-red-light" : "border-brand-border bg-brand-warm-white"
              }`}
            >
              <span className="truncate text-label font-semibold text-brand-gray">{task.title}</span>
              <span className={`mt-0.5 text-[13px] ${step === "overdue" ? "font-bold text-brand-red" : "text-brand-near-black"}`}>
                {detail(task, step)}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-2 lg:mt-auto lg:pt-2">
                <Link
                  href={adminHref("ciclo", VIEW[step], { cycle: task.cycleId })}
                  className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-center text-[13px] font-bold ${
                    step === "overdue"
                      ? "bg-brand-red text-white"
                      : "bg-primary text-on-primary"
                  }`}
                >
                  {cta(step)}
                </Link>
                {(step === "to_send" || step === "to_adjust") && (
                  <button
                    type="button"
                    onClick={() => markDone(task.cycleId, step)}
                    title={d.markHint}
                    className="min-h-11 rounded-xl border border-brand-border bg-white px-3 text-[13px] font-semibold text-brand-near-black"
                  >
                    {step === "to_send" ? d.markSent : d.markDelivered}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {visible.length > SHOWN_SMALL && (
        <p className="px-1 pt-2 text-label text-muted lg:hidden">{d.more(visible.length - SHOWN_SMALL)}</p>
      )}
      {visible.length > SHOWN && <p className="hidden px-1 pt-2 text-label text-muted lg:block">{d.more(visible.length - SHOWN)}</p>}
      {(refunds > 0 || duplicates > 0) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2 text-[13px]">
          {refunds > 0 && (
            <Link href={adminHref("cassa", null)} className="flex min-h-10 items-center font-semibold text-primary-text">
              {d.refunds(refunds)} →
            </Link>
          )}
          {duplicates > 0 && (
            <Link href={adminHref("soci", null)} className="flex min-h-10 items-center font-semibold text-primary-text">
              {d.duplicates(duplicates)} →
            </Link>
          )}
        </p>
      )}
    </section>
  );
}

function cta(step: CycleStep): string {
  const d = t.admin.workspace.todo;
  return { overdue: d.overdueCta, open: d.openCta, to_send: d.sendCta, to_adjust: d.adjustCta, to_settle: d.settleCta }[step];
}

function detail(task: CycleTask, step: CycleStep): string {
  const d = t.admin.workspace.todo;
  switch (step) {
    case "overdue":
      return d.overdueDetail(task.hours ?? 0);
    case "open":
      return d.openDetail(task.orderMembers, task.hours);
    case "to_send":
      return d.sendDetail;
    case "to_adjust":
      return d.adjustDetail;
    case "to_settle":
      return d.settleDetail;
  }
}
