"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";
import { updateNotificationPreference } from "@/lib/actions/notifications";
import {
  NOTIFICATION_CATEGORIES,
  type ChannelPrefs,
  type NotificationCategory,
} from "@/lib/notifications/categories";

type Props = {
  initial: Record<NotificationCategory, ChannelPrefs>;
};

// Per-category channel toggles. State is optimistic: we flip the checkbox
// immediately, persist in the background, and roll back only if the server
// action reports an error. Each toggle sends the whole (app, email) pair so
// the upsert writes a complete row.
export function NotificationPreferencesForm({ initial }: Props) {
  const [prefs, setPrefs] = useState<Record<NotificationCategory, ChannelPrefs>>(initial);
  const [isPending, startTransition] = useTransition();

  function toggle(category: NotificationCategory, channel: "app" | "email", value: boolean) {
    const previous = prefs[category];
    const next: ChannelPrefs = { ...previous, [channel]: value };
    setPrefs((p) => ({ ...p, [category]: next }));
    startTransition(async () => {
      const result = await updateNotificationPreference({
        category,
        appEnabled: next.app,
        emailEnabled: next.email,
      });
      if ("error" in result) {
        setPrefs((p) => ({ ...p, [category]: previous }));
        toast.error(result.error);
      } else {
        toast.success(t.notifications.settings.saved);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {NOTIFICATION_CATEGORIES.map((category, i) => {
        const cfg = t.notifications.settings.categories[category];
        const p = prefs[category];
        return (
          <div
            key={category}
            className={`flex items-start gap-3 px-4 py-[14px] ${
              i < NOTIFICATION_CATEGORIES.length - 1 ? "border-b border-brand-border" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-brand-near-black">{cfg.label}</div>
              <div className="mt-[3px] text-[12px] leading-snug text-brand-gray">{cfg.hint}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <ChannelToggle
                label={t.notifications.settings.channelApp}
                checked={p.app}
                disabled={isPending}
                onChange={(v) => toggle(category, "app", v)}
              />
              <ChannelToggle
                label={t.notifications.settings.channelEmail}
                checked={p.email}
                disabled={isPending}
                onChange={(v) => toggle(category, "email", v)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChannelToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex w-[52px] cursor-pointer flex-col items-center gap-1 py-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-gray-light">
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-brand-orange disabled:opacity-50"
      />
    </label>
  );
}
