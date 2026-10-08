"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { updateMyName } from "@/lib/actions/profile";
import { t } from "@/lib/i18n";
import { NAME_MAX_LENGTH } from "@/lib/profile/summary";

// The name row of the Profile page: shows the name, edits it in place.
export function NameEditor({ name }: { name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [isPending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateMyName(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex min-h-[52px] items-center gap-3 px-4 py-[12px]">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-brand-near-black">{t.profile.name}</div>
          <div className="mt-[2px] break-words text-[12px] leading-snug text-brand-gray">{name}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          {t.profile.edit}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="px-4 py-[12px]">
      <label htmlFor="profile-name" className="text-[14px] font-bold text-brand-near-black">
        {t.profile.name}
      </label>
      <p className="mt-[2px] text-[12px] leading-snug text-brand-gray">{t.profile.nameHint}</p>
      <input
        id="profile-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="name"
        autoFocus
        required
        className="mt-2 w-full rounded-[12px] border border-brand-border bg-white px-3 py-2 text-[14px] text-brand-near-black focus:border-primary"
      />
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="orange" size="sm" disabled={isPending || value.trim().length === 0}>
          {t.common.save}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => setEditing(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
