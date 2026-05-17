"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Built-in suggestions, ordered by typical GAS-shopping prevalence.
 * Admins can still add their own — see `extra` and the inline "+ aggiungi" row.
 */
const DEFAULT_CATEGORIES = [
  "Frutta",
  "Verdura",
  "Pane e cereali",
  "Pasta e riso",
  "Latticini",
  "Uova",
  "Carne",
  "Pesce",
  "Conserve",
  "Olio e aceto",
  "Bevande",
  "Dolci",
  "Altro",
] as const;

type Props = {
  /** Form field name — used by FormData on the parent form. */
  name: string;
  /** Current value (or empty string for "no category yet"). */
  value: string;
  /** Categories already present in the catalog. Merged with the defaults. */
  extra?: ReadonlyArray<string>;
  placeholder?: string;
};

/**
 * Searchable single-select for product category, with an inline option to
 * add a brand-new category. The selection is mirrored to a hidden
 * `<input name={name}>` so the parent form picks it up via FormData.
 */
export function CategorySelect({ name, value, extra = [], placeholder = "Scegli una categoria" }: Props) {
  const [selected, setSelected] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  // Categories the admin has typed during this session — appended to the
  // base list so a newly-added one stays selectable without a reload.
  const [sessionAdded, setSessionAdded] = useState<string[]>([]);

  const options = useMemo(() => {
    const merged = new Set<string>([
      ...DEFAULT_CATEGORIES,
      ...extra,
      ...sessionAdded,
    ]);
    // Make sure the current value, even if exotic, is visible at the top.
    if (selected && !merged.has(selected)) merged.add(selected);
    return Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b, "it"));
  }, [extra, sessionAdded, selected]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setNewCat("");
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setAdding(false);
        setNewCat("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (adding) setTimeout(() => newInputRef.current?.focus(), 0);
  }, [adding]);

  function pick(cat: string) {
    setSelected(cat);
    setOpen(false);
    setAdding(false);
    setNewCat("");
  }

  function confirmAdd() {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    setSessionAdded((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    pick(trimmed);
  }

  const triggerCls =
    "flex w-full items-center justify-between rounded-lg border border-pm-border bg-white px-3 py-2 text-left text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30";

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selected} readOnly />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerCls}
      >
        <span className={selected ? "" : "text-pm-gray-light"}>
          {selected || placeholder}
        </span>
        <span className="ml-2 text-pm-gray-light">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-[260px] overflow-y-auto rounded-lg border border-pm-border bg-white shadow-lg"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === selected}
              onClick={() => pick(opt)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] transition hover:bg-pm-teal-light ${
                opt === selected ? "bg-pm-teal-light font-semibold text-pm-teal" : "text-pm-near-black"
              }`}
            >
              <span>{opt}</span>
              {opt === selected && <span className="text-[11px] text-pm-teal">✓</span>}
            </button>
          ))}

          {/* "+ aggiungi nuova" row */}
          <div className="border-t border-pm-border bg-pm-warm-white">
            {adding ? (
              <div className="flex items-center gap-1 p-2">
                <input
                  ref={newInputRef}
                  type="text"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmAdd();
                    }
                  }}
                  placeholder="Nuova categoria…"
                  className="flex-1 rounded-md border border-pm-border bg-white px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
                />
                <button
                  type="button"
                  onClick={confirmAdd}
                  className="rounded-md bg-pm-teal px-2 py-1 text-[11px] font-bold text-white"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewCat("");
                  }}
                  className="rounded-md px-2 py-1 text-[11px] text-pm-gray"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-semibold text-pm-teal hover:bg-pm-teal-light"
              >
                <span aria-hidden>+</span> Aggiungi nuova categoria
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
