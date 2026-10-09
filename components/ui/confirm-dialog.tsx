"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useSwipeDown } from "@/lib/ui/use-swipe";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Request = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

let listener: ((req: Request) => void) | null = null;

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!listener) {
      // Provider not mounted (e.g. during SSR or before hydration).
      // Resolve to false so the call site treats it as "cancelled".
      resolve(false);
      return;
    }
    listener({ ...options, resolve });
  });
}

/** Asked before a sheet holding unsaved work closes: true means close anyway. */
export function confirmDiscard(): Promise<boolean> {
  return confirm({
    title: t.common.discardTitle,
    message: t.common.discardMessage,
    confirmLabel: t.common.discardConfirm,
    cancelLabel: t.common.keepEditing,
    danger: true,
  });
}

export function ConfirmDialogProvider() {
  const [request, setRequest] = useState<Request | null>(null);
  // Dragging the sheet down is always "Annulla", destructive or not.
  const { target: swipeTarget, handlers: swipeHandlers } = useSwipeDown<HTMLDivElement>(() => close(false));

  useEffect(() => {
    listener = (req) => setRequest(req);
    return () => {
      listener = null;
    };
  }, []);

  function close(result: boolean) {
    if (request) {
      request.resolve(result);
      setRequest(null);
    }
  }

  const open = request !== null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        {/* A sheet from the bottom on phones (buttons stacked near the thumb,
            drag down = Annulla), a small centred window from sm. */}
        <Dialog.Content
          ref={swipeTarget}
          aria-describedby={undefined}
          {...swipeHandlers}
          className="fixed inset-x-0 bottom-0 z-[151] touch-none rounded-t-3xl border border-brand-border bg-white px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center shadow-[0_8px_32px_rgba(45,43,41,0.15)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[90%] sm:max-w-[340px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:touch-auto sm:rounded-3xl sm:p-8 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/15 sm:hidden" />
          <Dialog.Title className="mb-3 text-lg font-bold text-brand-near-black">
            {request?.title}
          </Dialog.Title>
          {request?.message && (
            <Dialog.Description className="mb-5 text-[15px] text-brand-gray">
              {request.message}
            </Dialog.Description>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="outline"
              block
              onClick={() => close(false)}
              // A destructive request starts on Cancel: Enter must not delete.
              autoFocus={request?.danger === true}
            >
              {request?.cancelLabel ?? t.common.cancel}
            </Button>
            <Button
              variant={request?.danger ? "danger" : "neutral"}
              block
              onClick={() => close(true)}
              autoFocus={request?.danger !== true}
            >
              {request?.confirmLabel ?? t.common.confirm}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
