"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminSetSignup } from "@/lib/actions/admin-settings";
import { SIGNUP_MODES, SIGNUP_ROLES, type SignupMode, type SignupRole } from "@/lib/membership/signup";
import { t } from "@/lib/i18n";

// Impostazioni -> Soci: who may join without being added by an admin
// (lib/membership/signup.ts), the role newcomers get and whether they pay
// before ordering. Each change is saved at once; a refused save puts the
// stored values back.
export function SignupCard({ mode: savedMode, role: savedRole, prepaid: savedPrepaid }: { mode: SignupMode; role: SignupRole; prepaid: boolean }) {
  const s = t.admin.settings.signup;
  const [value, setValue] = useState({ mode: savedMode, role: savedRole, prepaid: savedPrepaid });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save(next: typeof value) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await adminSetSignup(next);
      if (result.error) {
        setValue(previous);
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  const option = "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5";
  return (
    <section id="chi-entra" className="space-y-4 rounded-xl border border-border bg-card p-4">
      <fieldset disabled={isPending}>
        <legend className="text-[13px] font-bold text-foreground">{s.title}</legend>
        <p className="mt-1 text-[12px] text-secondary-foreground">{s.hint}</p>
        <div className="mt-3 space-y-2">
          {SIGNUP_MODES.map((m) => (
            <label key={m} className={option}>
              <input
                type="radio"
                name="signup-mode"
                value={m}
                checked={value.mode === m}
                onChange={() => save({ ...value, mode: m })}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block text-[13px] font-semibold text-foreground">{s.modes[m].label}</span>
                <span className="block text-[12px] text-secondary-foreground">{s.modes[m].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {value.mode !== "closed" ? (
        <>
          {/* Not a <legend>: the panel hides a first-level legend as its title. */}
          <div role="radiogroup" aria-labelledby="signup-role-title">
            <p id="signup-role-title" className="text-[13px] font-bold text-foreground">
              {s.roleTitle}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SIGNUP_ROLES.map((r) => (
                <label key={r} className={`${option} items-center`}>
                  <input
                    type="radio"
                    name="signup-role"
                    value={r}
                    checked={value.role === r}
                    disabled={isPending}
                    onChange={() => save({ ...value, role: r })}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="text-[13px] font-semibold text-foreground">{t.roles[r]}</span>
                </label>
              ))}
            </div>
          </div>
          <label className={option}>
            <input
              type="checkbox"
              checked={value.prepaid}
              disabled={isPending}
              onChange={(e) => save({ ...value, prepaid: e.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-[13px] font-semibold text-foreground">{s.prepaid}</span>
              <span className="block text-[12px] text-secondary-foreground">{s.prepaidHint}</span>
            </span>
          </label>
          <p className="text-[12px] text-secondary-foreground">{s.pageHint}</p>
        </>
      ) : null}
    </section>
  );
}
