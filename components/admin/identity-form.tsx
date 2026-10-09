"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminRemoveLogo, adminUpdateIdentity, adminUploadLogo } from "@/lib/actions/admin-identity";
import { THEME_KEYS, type IdentityOverrides, type ThemeKey } from "@/lib/brand/identity";
import { brandContrastWarnings, deriveRoleVars, resolvePalette } from "@/lib/brand/roles";
import type { BrandConfig } from "@/lib/brand/types";
import { t } from "@/lib/i18n";

// The group's identity as its admins edit it (first-run setup and
// Impostazioni): "identity" is names, logo and colours, "contacts" the
// addresses and links. An empty field goes back to the deploy's brand JSON,
// shown as the placeholder.

type Props = {
  section: "identity" | "contacts";
  /** The deploy's brand JSON (what an empty field falls back to). */
  defaults: BrandConfig;
  /** What the admins saved (group_identity). */
  current: IdentityOverrides;
  /** The logo in force and whether it is the uploaded one. */
  logoUrl: string;
  uploadedLogo: boolean;
};

const input =
  "mt-1 w-full rounded-xl border border-brand-border px-3 py-2 text-[13px] text-brand-near-black placeholder:text-muted focus:border-primary";
const label = "block text-[12px] font-bold text-brand-near-black";
const hint = "mt-1 text-[12px] text-brand-gray";

export function IdentityForm(props: Props) {
  return props.section === "identity" ? <IdentitySection {...props} /> : <ContactsSection {...props} />;
}

function useSave() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const s = t.admin.settings.identity;
  function save(values: Record<string, unknown>) {
    startTransition(async () => {
      const result = await adminUpdateIdentity(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }
  return { isPending, save };
}

function Field({
  id,
  title,
  value,
  onChange,
  placeholder,
  help,
  type = "text",
  maxLength,
}: {
  id: string;
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  help?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={input}
      />
      {help && <p className={hint}>{help}</p>}
    </div>
  );
}

function IdentitySection({ defaults, current, logoUrl, uploadedLogo }: Props) {
  const s = t.admin.settings.identity;
  const { isPending, save } = useSave();
  const [appName, setAppName] = useState(current.appName ?? "");
  const [shortName, setShortName] = useState(current.shortName ?? "");
  const [description, setDescription] = useState(current.description ?? "");
  const [orgName, setOrgName] = useState(current.orgName ?? "");
  const [showName, setShowName] = useState(current.headerShowName ?? defaults.headerShowName);
  const [theme, setTheme] = useState<Record<ThemeKey, string>>(
    () => Object.fromEntries(THEME_KEYS.map((k) => [k, current.theme?.[k] ?? ""])) as Record<ThemeKey, string>,
  );

  // What an empty colour falls back to: the brand JSON's, else WeGrocery's.
  const fallbackPalette = resolvePalette(defaults.theme);
  const effectiveTheme = Object.fromEntries(
    THEME_KEYS.map((k) => [k, theme[k] || defaults.theme[k] || undefined]),
  ) as BrandConfig["theme"];
  const validTheme = Object.fromEntries(
    Object.entries(effectiveTheme).filter(([, v]) => v && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)),
  );
  const warnings = brandContrastWarnings(validTheme);
  const vars = deriveRoleVars(validTheme);

  function handleSave() {
    save({ appName, shortName, description, orgName, headerShowName: showName, theme });
  }

  return (
    <section className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <h3 className="text-[13px] font-bold text-brand-near-black">{s.title}</h3>
      <p className={hint}>{s.hint}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field id="identity-app-name" title={s.appName} value={appName} onChange={setAppName} placeholder={defaults.appName} help={s.appNameHint} maxLength={60} />
        <Field id="identity-short-name" title={s.shortName} value={shortName} onChange={setShortName} placeholder={defaults.shortName} help={s.shortNameHint} maxLength={20} />
        <Field id="identity-org-name" title={s.orgName} value={orgName} onChange={setOrgName} placeholder={defaults.orgName} help={s.orgNameHint} maxLength={100} />
        <Field id="identity-description" title={s.description} value={description} onChange={setDescription} placeholder={defaults.description} maxLength={200} />
      </div>

      <LogoField logoUrl={logoUrl} uploaded={uploadedLogo} shortName={shortName || defaults.shortName} />

      <label className="mt-3 flex min-h-11 items-center gap-2 text-[13px] text-brand-near-black">
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-4 w-4" />
        {s.headerShowName}
      </label>

      <h4 className="mt-4 text-[12px] font-bold text-brand-near-black">{s.colors}</h4>
      <p className={hint}>{s.colorsHint}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {THEME_KEYS.map((k) => (
          <ColorField
            key={k}
            id={`identity-color-${k}`}
            title={s.colorLabels[k]}
            value={theme[k]}
            fallback={fallbackPalette[k]}
            onChange={(v) => setTheme((prev) => ({ ...prev, [k]: v }))}
          />
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-brand-border p-3" style={vars as React.CSSProperties}>
        <p className="font-mono text-label uppercase tracking-[0.1em] text-brand-gray">{s.preview}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-brand-frame p-3">
          <span className="rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-on-primary">{s.previewButton}</span>
          <span className="rounded-lg border border-primary-mid bg-primary-soft px-3 py-2 text-[13px] font-bold text-primary-text">
            {s.previewBalance} 12,50 €
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-bold text-on-accent">{appName || defaults.shortName}</span>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg bg-brand-red-light p-3 text-[12px] text-brand-red">
          <p className="font-bold">{s.contrastWarnings}</p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="mt-4 rounded-xl bg-brand-near-black px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : s.save}
      </button>
    </section>
  );
}

function ColorField({
  id,
  title,
  value,
  fallback,
  onChange,
}: {
  id: string;
  title: string;
  value: string;
  fallback: string | undefined;
  onChange: (v: string) => void;
}) {
  const s = t.admin.settings.identity;
  const shown = value || fallback || "";
  const pickerValue = /^#[0-9a-f]{6}$/i.test(shown) ? shown : "#000000";
  return (
    <div>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={title}
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-brand-border bg-white p-1"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder={fallback ?? s.colorDefault}
          maxLength={7}
          className="w-full rounded-xl border border-brand-border px-3 py-2 font-mono text-[13px] text-brand-near-black placeholder:text-muted focus:border-primary"
        />
      </div>
    </div>
  );
}

function LogoField({ logoUrl, uploaded, shortName }: { logoUrl: string; uploaded: boolean; shortName: string }) {
  const s = t.admin.settings.identity;
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleFile(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("logo", file);
    startTransition(async () => {
      const result = await adminUploadLogo(form);
      if (fileRef.current) fileRef.current.value = "";
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.logoUploaded);
      router.refresh();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await adminRemoveLogo();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.logoRemoved);
      router.refresh();
    });
  }

  return (
    <div className="mt-4">
      <p className={label}>{s.logo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-brand-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={shortName} className="max-h-14 max-w-14 object-contain" />
        </span>
        <input
          ref={fileRef}
          id="identity-logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <label
          htmlFor="identity-logo"
          className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-brand-border px-4 py-2 text-[13px] font-bold text-brand-near-black"
        >
          {isPending ? t.admin.common.saving : uploaded ? s.logoReplace : s.logoUpload}
        </label>
        {uploaded && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="min-h-11 rounded-xl px-3 py-2 text-[13px] font-bold text-brand-red disabled:opacity-60"
          >
            {s.logoRemove}
          </button>
        )}
      </div>
      <p className={hint}>{s.logoHint}</p>
    </div>
  );
}

function ContactsSection({ defaults, current }: Props) {
  const s = t.admin.settings.identity;
  const { isPending, save } = useSave();
  const optional = (v: string | null | undefined, fallback: string | null) => (v === undefined ? fallback ?? "" : v ?? "");
  const [supportEmail, setSupportEmail] = useState(current.supportEmail ?? "");
  const [techEmail, setTechEmail] = useState(current.techEmail ?? "");
  const [archiveCcEmail, setArchive] = useState(optional(current.archiveCcEmail, defaults.archiveCcEmail));
  const [privacyUrl, setPrivacy] = useState(optional(current.privacyUrl, defaults.privacyUrl));
  const [membershipUrl, setMembership] = useState(optional(current.membershipUrl, defaults.membershipUrl));

  return (
    <section className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <h3 className="text-[13px] font-bold text-brand-near-black">{s.contacts}</h3>
      <p className={hint}>{s.contactsHint}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field id="identity-support" type="email" title={s.supportEmail} value={supportEmail} onChange={setSupportEmail} placeholder={defaults.supportEmail} />
        <Field id="identity-tech" type="email" title={s.techEmail} value={techEmail} onChange={setTechEmail} placeholder={defaults.techEmail} />
        <Field id="identity-archive" type="email" title={s.archiveCcEmail} value={archiveCcEmail} onChange={setArchive} />
        <Field id="identity-privacy" type="url" title={s.privacyUrl} value={privacyUrl} onChange={setPrivacy} placeholder="https://" />
        <Field id="identity-membership" type="url" title={s.membershipUrl} value={membershipUrl} onChange={setMembership} placeholder="https://" />
      </div>
      <button
        type="button"
        onClick={() => save({ supportEmail, techEmail, archiveCcEmail, privacyUrl, membershipUrl })}
        disabled={isPending}
        className="mt-4 rounded-xl bg-brand-near-black px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : s.save}
      </button>
    </section>
  );
}
