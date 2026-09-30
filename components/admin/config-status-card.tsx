import { Card, CardHeader } from "@/components/ui/card";
import type { ConfigItem } from "@/lib/config-status";
import { t } from "@/lib/i18n";

const STATUS_CLASSES: Record<ConfigItem["status"], string> = {
  ok: "bg-accent-soft text-accent-text",
  missing: "bg-brand-red-light text-brand-red",
  warning: "bg-primary-soft text-primary-text",
  off: "bg-black/[0.05] text-muted",
};

// What this installation has connected (lib/config-status.ts): names and
// states only, never a value.
export function ConfigStatusCard({ items }: { items: ConfigItem[] }) {
  const s = t.admin.configStatus;
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13px] font-bold text-brand-near-black">{s.title}</h3>
        <p className="mt-1 text-[12px] text-brand-gray">{s.intro}</p>
      </CardHeader>
      <ul className="divide-y divide-brand-border">
        {items.map((item) => {
          // Stripe's event list matters once a key is set.
          const detail = item.id === "stripe" && item.status === "off" ? undefined : item.detail;
          return (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-brand-near-black">
                    {s.items[item.id]}
                    {item.required && <span className="ml-1 font-normal text-muted">({s.required})</span>}
                  </div>
                  <div className="mt-[2px] break-words font-mono text-label text-brand-gray">
                    {s.variables} {item.vars.join(", ")}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-label font-bold ${STATUS_CLASSES[item.status]}`}>
                  {s.status[item.status]}
                </span>
              </div>
              {item.note && s.notes[item.note] && (
                <p className="mt-1 text-[12px] text-brand-near-black">{s.notes[item.note]}</p>
              )}
              {detail && detail.length > 0 && (
                <>
                  {item.id === "stripe" && <p className="mt-1 text-[12px] text-brand-near-black">{s.notes.stripeEvents}</p>}
                  <ul className="mt-1 list-inside list-disc font-mono text-label text-brand-gray">
                    {detail.map((d) => (
                      <li key={d} className="break-words">
                        {d}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
