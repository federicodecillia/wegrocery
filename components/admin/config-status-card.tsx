import { Card, CardHeader } from "@/components/ui/card";
import type { ConfigItem } from "@/lib/config-status";
import { REQUIRED_STRIPE_EVENTS } from "@/lib/payments/config";
import { t } from "@/lib/i18n";

const STATUS_CLASSES: Record<ConfigItem["status"], string> = {
  ok: "bg-accent-soft text-accent-text",
  missing: "bg-brand-red-light text-brand-red",
  warning: "bg-primary-soft text-primary-text",
  off: "bg-black/[0.05] text-muted",
};

// Integrations a group can live without: the card lists them apart.
const OPTIONAL = new Set<ConfigItem["id"]>(["brand", "stripe", "membership", "sentry", "fleet"]);

// What this installation has connected (lib/config-status.ts): names and
// states only, never a value. Nothing here is set from this card: each item
// says what it does and how it is turned on (by whoever hosts the app, or,
// for Stripe, also from the payment settings' Stripe card).
export function ConfigStatusCard({ items }: { items: ConfigItem[] }) {
  const s = t.admin.configStatus;
  const groups = [
    { id: "essential", items: items.filter((i) => !OPTIONAL.has(i.id)) },
    { id: "optional", items: items.filter((i) => OPTIONAL.has(i.id)) },
  ] as const;
  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13px] font-bold text-brand-near-black">{s.title}</h3>
        <p className="mt-1 text-[12px] text-brand-gray">{s.intro}</p>
      </CardHeader>
      {groups.map((group) => (
        <section key={group.id}>
          <h4 className="border-t border-brand-border bg-black/[0.02] px-4 py-2 font-mono text-label uppercase tracking-[0.08em] text-brand-gray">
            {s.groups[group.id]}
          </h4>
          <ul className="divide-y divide-brand-border border-t border-brand-border">
            {group.items.map((item) => (
              <ConfigRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </Card>
  );
}

function ConfigRow({ item }: { item: ConfigItem }) {
  const s = t.admin.configStatus;
  // Stripe's event list matters once a key is set.
  const detail = item.id === "stripe" && item.status === "off" ? undefined : item.detail;
  const help = s.help[item.id];
  return (
    <li className="px-4 py-3">
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
      {item.note && s.notes[item.note] && <p className="mt-1 text-[12px] text-brand-near-black">{s.notes[item.note]}</p>}
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
      {help && (
        <details className="mt-2 text-[12px]">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary-text">{s.howTo}</summary>
          <p className="text-brand-near-black">{help[0]}</p>
          <p className="mt-1 break-words text-brand-gray">{help[1]}</p>
          {item.id === "stripe" && (
            <ul className="mt-1 list-inside list-disc font-mono text-label text-brand-gray">
              {REQUIRED_STRIPE_EVENTS.map((e) => (
                <li key={e} className="break-words">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </li>
  );
}
