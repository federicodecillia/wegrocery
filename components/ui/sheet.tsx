"use client";

import { useEffect, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSwipeDown } from "@/lib/ui/use-swipe";

export interface SheetProps {
  open: boolean;
  /**
   * Called for every way out (Esc, a tap outside, the ✕). A sheet holding
   * unsaved work asks first here and closes only if the answer is yes.
   */
  onRequestClose: () => void;
  title: ReactNode;
  /** One line under the title (the cycle's name, the member's name...). */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky at the bottom, above the safe area: totals and the actions. */
  footer?: ReactNode;
  /** `md` (640 px) for forms and lists, `sm` (420 px) for a short message, `lg` (820 px) for wide tables. */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Drag down on the handle or header to close, on phones. Off for the cycle-close review. */
  swipeToClose?: boolean;
}

/**
 * The one dialog shape of the app: a sheet rising from the bottom on phones
 * (with a handle, actions near the thumb) and a centred window from `sm` up.
 * Radix traps focus inside and gives it back to the opening control on close.
 */
export function Sheet({ open, onRequestClose, title, subtitle, children, footer, size = "md", className, swipeToClose = true }: SheetProps) {
  const { target: swipeTarget, handlers: swipeHandlers } = useSwipeDown<HTMLDivElement>(onRequestClose, swipeToClose);
  // Radix gives focus back only when `open` turns false; most callers unmount
  // the sheet instead, so the opener is remembered and refocused here too.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      setTimeout(() => {
        if (opener?.isConnected && !document.querySelector("[role=dialog]")) opener.focus();
      });
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onRequestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          ref={swipeTarget}
          // The subtitle is the description; without one there is none.
          {...(subtitle ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-brand-warm-white shadow-2xl",
            "sm:inset-y-0 sm:my-auto sm:h-fit sm:max-h-[88dvh] sm:rounded-2xl",
            { sm: "max-w-[420px]", md: "max-w-[640px]", lg: "max-w-[820px]" }[size],
            className,
          )}
          // Radix would close on its own; the caller decides instead.
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onRequestClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            onRequestClose();
          }}
        >
          {/* The drag zone: handle and header. */}
          <div {...swipeHandlers} className={cn("shrink-0", swipeToClose && "touch-none sm:touch-auto")}>
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-black/15 sm:hidden" />
            <header className="flex items-start justify-between gap-3 border-b border-brand-border px-5 pt-2 pb-4 sm:pt-4">
              <div className="min-w-0">
                <Dialog.Title className="text-[16px] font-bold text-brand-near-black">{title}</Dialog.Title>
                {subtitle && (
                  <Dialog.Description className="mt-0.5 text-[13px] text-brand-gray">{subtitle}</Dialog.Description>
                )}
              </div>
              <button
                type="button"
                onClick={onRequestClose}
                aria-label={t.common.close}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-gray hover:bg-black/5"
              >
                <span aria-hidden>✕</span>
              </button>
            </header>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <footer className="border-t border-brand-border bg-white px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Actions stacked on phones (main one at the bottom, near the thumb), side by side from `sm`. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row">{children}</div>;
}
