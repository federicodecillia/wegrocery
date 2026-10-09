import Link from "next/link";
import { Badge, type Tone } from "@/components/ui";
import { STEPS, type StepId, type StepStates } from "@/lib/provisioning/steps";
import { cn } from "@/lib/utils";

const STATUS: Record<StepStates[StepId], { label: string; tone: Tone; mark: string }> = {
  todo: { label: "Da fare", tone: "neutral", mark: "○" },
  done: { label: "Fatto", tone: "ok", mark: "✓" },
  failed: { label: "Fallito", tone: "danger", mark: "!" },
  skipped: { label: "Saltato", tone: "neutral", mark: "–" },
};

export function StepChecklist({
  states,
  details,
  current,
  instanceId,
}: {
  states: StepStates;
  details?: Partial<Record<StepId, string | null>>;
  current?: StepId | null;
  /** When set, each step links to its page in the wizard. */
  instanceId?: string;
}) {
  return (
    <ol className="flex flex-col gap-1.5">
      {STEPS.map((s, n) => {
        const st = STATUS[states[s.id]];
        const label = `${n + 1}. ${s.label}${s.optional ? " (facoltativo)" : ""}`;
        return (
          <li
            key={s.id}
            className={cn("rounded-lg border border-transparent px-2 py-1.5", current === s.id && "border-line bg-bg")}
            aria-current={current === s.id ? "step" : undefined}
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              {instanceId ? (
                <Link href={`/nuovo?istanza=${instanceId}&passo=${s.id}`} className="hover:underline">
                  {label}
                </Link>
              ) : (
                <span>{label}</span>
              )}
              <Badge tone={st.tone}>
                <span aria-hidden="true" className="mr-1">{st.mark}</span>
                {st.label}
              </Badge>
            </div>
            {details?.[s.id] && <p className="mt-0.5 text-xs break-words text-muted">{details[s.id]}</p>}
          </li>
        );
      })}
    </ol>
  );
}
