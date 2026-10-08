"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

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

export function ConfirmDialogProvider() {
  const [request, setRequest] = useState<Request | null>(null);

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
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[151] w-[90%] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-brand-border bg-white p-8 text-center shadow-[0_8px_32px_rgba(45,43,41,0.15)] data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95"
        >
          <Dialog.Title className="mb-3 text-lg font-bold text-brand-near-black">
            {request?.title}
          </Dialog.Title>
          {request?.message && (
            <Dialog.Description className="mb-5 text-[15px] text-brand-gray">
              {request.message}
            </Dialog.Description>
          )}
          <div className="flex gap-3">
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
              variant={request?.danger ? "red" : "primary"}
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
