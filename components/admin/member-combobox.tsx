"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { filterMembers } from "./member-search";

export type PickerMember = {
  memberId: string;
  fullName: string;
  email: string;
  active: boolean;
  balance: number;
};

type Props = {
  members: ReadonlyArray<PickerMember>;
  value: PickerMember | null;
  onChange: (member: PickerMember | null) => void;
  label: string;
};

function BalanceText({ balance }: { balance: number }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap font-mono text-label font-bold ${
        balance >= 0 ? "text-accent-text" : "text-brand-red"
      }`}
    >
      {t.admin.treasury.memberBalance(formatMoney(balance))}
    </span>
  );
}

// Member picker for the Cassa forms, following the WAI-ARIA combobox pattern
// (editable input + listbox, aria-activedescendant on the highlighted
// option): type part of a name or an email, then arrows + Enter, or a tap.
// Once a member is picked the field shows name, email and balance, so a
// homonym can't slip through, with a button to pick someone else.
export function MemberCombobox({ members, value, onChange, label }: Props) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Picking and "change" swap the input for the chip and back: focus moves
  // to the control that replaces the one that had it, once it is rendered.
  const pendingFocus = useRef<"input" | "change" | null>(null);

  const matches = useMemo(() => filterMembers(members, query), [members, query]);
  const activeIndex = Math.min(active, matches.length - 1);

  useEffect(() => {
    if (pendingFocus.current === "input") inputRef.current?.focus();
    if (pendingFocus.current === "change") changeRef.current?.focus();
    pendingFocus.current = null;
  });

  useEffect(() => {
    if (open && activeIndex >= 0) {
      document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex, baseId]);

  function pick(member: PickerMember) {
    onChange(member);
    setQuery("");
    setOpen(false);
    setActive(0);
    pendingFocus.current = "change";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive(Math.min(activeIndex + 1, matches.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setOpen(true);
        setActive(Math.max(activeIndex - 1, 0));
        break;
      case "Enter":
        // Never submit the surrounding form from the search box.
        e.preventDefault();
        if (open && activeIndex >= 0) pick(matches[activeIndex]);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        } else {
          setQuery("");
        }
        break;
    }
  }

  if (value) {
    return (
      <div>
        <span id={`${baseId}-label`} className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
          {label}
        </span>
        <div
          aria-labelledby={`${baseId}-label`}
          className="flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-brand-near-black">
              {value.fullName}
              {!value.active && (
                <span className="ml-1 font-normal text-brand-gray">{t.admin.treasury.inactiveHint}</span>
              )}
            </div>
            <div className="truncate font-mono text-label text-brand-gray">{value.email}</div>
            <BalanceText balance={value.balance} />
          </div>
          <button
            ref={changeRef}
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(true);
              pendingFocus.current = "input";
            }}
            aria-label={t.admin.treasury.memberChangeLabel(value.fullName)}
            className="min-h-[36px] shrink-0 rounded-lg border border-brand-border bg-white px-3 text-[12px] font-semibold text-brand-near-black"
          >
            {t.admin.treasury.memberChange}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        value={query}
        placeholder={t.admin.treasury.memberSearchPlaceholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <p className="sr-only" aria-live="polite">
        {open ? t.admin.treasury.memberResults(matches.length) : ""}
      </p>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-brand-border bg-white shadow-lg">
          <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto overscroll-contain">
            {matches.map((m, i) => (
              <li
                key={m.memberId}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                // Keep focus in the input so the tap is not lost to its blur.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                onMouseMove={() => {
                  if (i !== activeIndex) setActive(i);
                }}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2 ${
                  i === activeIndex ? "bg-accent-soft" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-brand-near-black">
                    {m.fullName}
                    {!m.active && <span className="ml-1 text-brand-gray">{t.admin.treasury.inactiveHint}</span>}
                  </div>
                  <div className="truncate font-mono text-label text-brand-gray">{m.email}</div>
                </div>
                <BalanceText balance={m.balance} />
              </li>
            ))}
          </ul>
          {matches.length === 0 && (
            <p className="px-3 py-3 text-center text-[12px] text-brand-gray">{t.admin.treasury.noMemberFound}</p>
          )}
        </div>
      )}
    </div>
  );
}
