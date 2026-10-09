"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rolloutPlanAction } from "@/app/actions/instances";
import { Badge, Button, Card, Notice, SectionTitle, type Tone } from "@/components/ui";
import { nextRolloutAction, type RolloutItem } from "@/lib/fleet/rollout";
import { redeployAndWait } from "./deploy-watch";

const STATUS: Record<RolloutItem["status"], { label: string; tone: Tone }> = {
  pending: { label: "In attesa", tone: "neutral" },
  deploying: { label: "In corso", tone: "warn" },
  done: { label: "Fatto", tone: "ok" },
  failed: { label: "Fallito", tone: "danger" },
};

/** "Aggiorna flotta": one instance at a time, stopping at the first failure. */
export function FleetRollout() {
  const router = useRouter();
  const [items, setItems] = useState<RolloutItem[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  async function start() {
    setError(null);
    const plan = await rolloutPlanAction();
    if (!plan.ok) return setError(plan.error);
    if (!plan.items.length) return setError("Nessuna istanza attiva collegata a un progetto Vercel.");
    const order = plan.items.map((i, n) => `${n + 1}. ${i.name}`).join("\n");
    if (!window.confirm(`Ridistribuire main su queste istanze, una alla volta?\n\n${order}`)) return;

    let list: RolloutItem[] = plan.items.map((i) => ({ instanceId: i.id, name: i.name, status: "pending" }));
    const update = (id: string, patch: Partial<RolloutItem>) => {
      list = list.map((it) => (it.instanceId === id ? { ...it, ...patch } : it));
      setItems(list);
    };
    setItems(list);
    setRunning(true);
    cancelled.current = false;

    for (let action = nextRolloutAction(list); action.kind === "deploy"; action = nextRolloutAction(list)) {
      if (cancelled.current) break;
      const id = action.instanceId;
      update(id, { status: "deploying", deploymentId: "pending", message: "Avvio…" });
      const r = await redeployAndWait(id, (message) => update(id, { message }), () => cancelled.current);
      update(id, { status: r.ok ? "done" : "failed", message: r.message });
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SectionTitle className="mb-1">Aggiorna flotta</SectionTitle>
          <p className="text-sm text-muted">
            Ridistribuisce main su ogni istanza attiva, una alla volta, aspettando che /api/health risponda prima di passare alla
            successiva. Si ferma al primo errore. L&apos;ordine segue il campo «ordine di rilascio» (più alto = più tardi).
          </p>
        </div>
        <div className="flex gap-2">
          {running ? (
            <Button variant="danger" onClick={() => (cancelled.current = true)}>
              Interrompi
            </Button>
          ) : (
            <Button variant="primary" onClick={start}>
              Aggiorna flotta
            </Button>
          )}
        </div>
      </div>
      {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
      {items && (
        <ol className="mt-4 divide-y divide-line text-sm">
          {items.map((it) => (
            <li key={it.instanceId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="font-medium sm:w-48">{it.name}</span>
              <Badge tone={STATUS[it.status].tone}>{STATUS[it.status].label}</Badge>
              {it.message && <span className="text-muted">{it.message}</span>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
