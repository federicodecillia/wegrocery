"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const CloseCreate = createContext<(() => void) | undefined>(undefined);

/** Inside a CreateToggle: folds it again (after saving, or on "Annulla"). */
export function useCloseCreate(): (() => void) | undefined {
  return useContext(CloseCreate);
}

// A create form used now and then (a new member, a new supplier) stays closed
// behind one button, so the list looked up every day comes first. The form
// inside reads useCloseCreate() to fold itself (a server page cannot pass it
// a function).
export function CreateToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <CloseCreate.Provider value={() => setOpen(false)}>{children}</CloseCreate.Provider>;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded={false}
      className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-primary-mid bg-primary-soft text-[13px] font-bold text-primary-text"
    >
      + {label}
    </button>
  );
}
