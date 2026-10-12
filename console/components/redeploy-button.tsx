"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { redeployAndWait } from "./deploy-watch";

export function RedeployButton({ instanceId, name, label = "Ridistribuisci", compact }: { instanceId: string; name: string; label?: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean | null; message: string } | null>(null);

  async function run() {
    if (!window.confirm(`Ridistribuire ${name} con l'ultima versione di main?`)) return;
    setBusy(true);
    setStatus({ ok: null, message: "Avvio…" });
    const r = await redeployAndWait(instanceId, (message) => setStatus({ ok: null, message }));
    setStatus(r);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={cn("flex flex-col gap-1", compact && "items-start")}>
      <Button onClick={run} disabled={busy} className={compact ? "min-h-8 px-2.5 py-1 text-xs" : undefined}>
        {busy ? "In corso…" : label}
      </Button>
      {status && (
        <p role="status" className={cn("max-w-xs text-xs", status.ok === false ? "text-danger" : status.ok ? "text-accent" : "text-muted")}>
          {status.message}
        </p>
      )}
    </div>
  );
}
