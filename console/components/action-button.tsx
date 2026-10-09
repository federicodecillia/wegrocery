"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonVariant } from "@/components/ui";
import { cn } from "@/lib/utils";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** A button that runs a server action and shows its outcome next to it. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  confirm,
  className,
}: {
  action: () => Promise<Result>;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  confirm?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={variant}
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            const r = await action();
            setResult(r);
            router.refresh();
          });
        }}
      >
        {pending ? (pendingLabel ?? "Attendere…") : label}
      </Button>
      {result && (result.ok ? result.message : result.error) && (
        <p role="status" className={cn("max-w-sm text-xs", result.ok ? "text-muted" : "text-danger")}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
