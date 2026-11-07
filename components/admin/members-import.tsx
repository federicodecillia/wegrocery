"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  adminImportMembers,
  adminInviteImported,
  previewMemberImport,
  type ImportPreview,
} from "@/lib/actions/admin-members";
import { IMPORT_MAX_BYTES, type ImportOutcome } from "@/lib/members/import";
import { t } from "@/lib/i18n";
import { useCloseCreate } from "./create-toggle";

const OUTCOMES: ImportOutcome[] = [
  "new",
  "possible_duplicate",
  "existing",
  "duplicate_in_file",
  "conflict",
  "invalid_email",
  "missing_email",
];

/** UTF-8 first; a file Excel saved in the old Windows encoding falls back to it. */
async function readText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Soci -> Importa da file: pick or paste a CSV, see what happens to every
// row, import, then send the invitations in small batches. The server plans
// the file again at each step, against the members of that moment.
export function MembersImport() {
  const s = t.admin.members.import;
  const close = useCloseCreate();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [toInvite, setToInvite] = useState<string[] | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const hasInvites = toInvite !== null && toInvite.length > 0;

  // After an import the list grows (and may show new duplicates) above the
  // fold: bring the invitation button back into view.
  useEffect(() => {
    if (hasInvites) sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [hasInvites]);

  const importable = preview ? preview.counts.new + preview.counts.possible_duplicate : 0;
  const total = preview ? Object.values(preview.counts).reduce((a, b) => a + b, 0) : 0;

  async function onFile(file: File) {
    if (file.size > IMPORT_MAX_BYTES) {
      toast.error(s.errors.tooBig);
      return;
    }
    setFileName(file.name);
    setText(await readText(file));
    setPreview(null);
  }

  function check() {
    startTransition(async () => {
      const result = await previewMemberImport(text);
      if (result.error) toast.error(result.error);
      setPreview(result.preview ?? null);
    });
  }

  function runImport() {
    startTransition(async () => {
      const result = await adminImportMembers(text);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.imported(result.created ?? 0));
      setPreview(null);
      setText("");
      setFileName("");
      setToInvite(result.memberIds ?? []);
      router.refresh();
    });
  }

  function invite() {
    if (!toInvite) return;
    startTransition(async () => {
      const result = await adminInviteImported(toInvite);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const remaining = result.remaining ?? [];
      toast.success(s.invited(result.sent ?? 0, remaining.length));
      setToInvite(remaining.length > 0 ? remaining : null);
      router.refresh();
    });
  }

  const label = "block mb-1 text-label font-semibold uppercase tracking-wide text-secondary-foreground";
  return (
    <section ref={sectionRef} aria-labelledby="import-title" className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="import-title" className="text-[13px] font-bold text-foreground">
          {s.title}
        </h2>
        {close && (
          <button type="button" onClick={close} className="inline-flex min-h-11 items-center gap-1 text-label text-secondary-foreground">
            <X aria-hidden className="size-3.5" />
            {s.cancel}
          </button>
        )}
      </div>

      {hasInvites ? (
        <div className="space-y-2">
          <Button type="button" variant="brand" block disabled={isPending} onClick={invite}>
            {s.invite(toInvite.length)}
          </Button>
          <p className="text-label text-secondary-foreground">{s.inviteNote}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="max-w-prose text-[13px] text-secondary-foreground">{s.intro}</p>
          <label className="block rounded-xl border-2 border-dashed border-border bg-background p-4 text-center">
            <span className={label}>{s.fileLabel}</span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="block w-full text-[13px] text-foreground file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-primary-bg file:px-4 file:font-bold file:text-primary-text"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            {fileName ? <span className="mt-1 block break-all text-label text-secondary-foreground">{fileName}</span> : null}
          </label>
          <label className="block">
            <span className={label}>{s.pasteLabel}</span>
            <Textarea
              rows={4}
              value={text}
              spellCheck={false}
              placeholder={"email;nome;cognome"}
              onChange={(e) => {
                setText(e.target.value);
                setFileName("");
                setPreview(null);
              }}
              className="text-[13px]"
            />
          </label>
          <Button type="button" variant="outline" block disabled={isPending || !text.trim()} onClick={check}>
            {s.check}
          </Button>
        </div>
      )}

      {preview ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-[13px] font-bold text-foreground">{s.summaryTitle}</h3>
          <ul className="grid gap-1 text-[13px] sm:grid-cols-2">
            {OUTCOMES.filter((o) => preview.counts[o] > 0).map((o) => (
              <li key={o} className="flex justify-between gap-2 rounded-lg bg-background px-3 py-2">
                <span className="text-foreground">{s.outcomes[o]}</span>
                <span className="font-bold tabular-nums text-foreground">{preview.counts[o]}</span>
              </li>
            ))}
          </ul>
          {preview.ignoredColumns.length > 0 ? (
            <p className="text-label text-secondary-foreground">{s.ignoredColumns(preview.ignoredColumns.join(", "))}</p>
          ) : null}
          {preview.adminRolesDropped > 0 ? (
            <p className="text-label text-secondary-foreground">{s.adminDropped(preview.adminRolesDropped)}</p>
          ) : null}
          <div
            // A scrolling region the keyboard can reach (axe: scrollable-region-focusable).
            tabIndex={0}
            role="region"
            aria-label={s.summaryTitle}
            className="max-h-80 overflow-auto rounded-lg border border-border"
          >
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-card text-secondary-foreground">
                <tr>
                  <th scope="col" className="px-2 py-1.5 font-semibold">{s.columns.line}</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">{s.columns.name}</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">{s.columns.email}</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">{s.columns.outcome}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.map((row) => (
                  <tr key={row.line} className="align-top">
                    <td className="px-2 py-1.5 tabular-nums text-secondary-foreground">{row.line}</td>
                    <td className="px-2 py-1.5 text-foreground">{row.fullName}</td>
                    <td className="break-all px-2 py-1.5 text-foreground">{row.email}</td>
                    <td className="px-2 py-1.5 text-foreground">{s.outcomes[row.outcome]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length < total ? (
            <p className="text-label text-secondary-foreground">{s.moreRows(preview.rows.length, total)}</p>
          ) : null}
          {importable > 0 ? (
            <Button type="button" variant="brand" block disabled={isPending} onClick={runImport}>
              {s.importButton(importable)}
            </Button>
          ) : (
            <p className="text-[13px] text-secondary-foreground">{s.nothingToImport}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
