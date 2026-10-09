"use client";

import { Toaster as SonnerToaster } from "sonner";
import { t } from "@/lib/i18n";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      duration={3000}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: t.common.close,
        classNames: {
          toast:
            "relative flex items-center justify-center w-full max-w-[90vw] mx-auto px-6 py-3 [&:has([data-close-button])]:pr-12 rounded-full font-medium text-sm text-white bg-brand-near-black shadow-[0_4px_16px_rgba(45,43,41,0.2)]",
          success: "bg-brand-near-black",
          warning: "bg-warning",
          error: "bg-brand-red",
          info: "bg-brand-near-black",
          // Set per toast by components/ui/toast.tsx (errors and warnings).
          closeButton:
            "absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white hover:bg-white/15",
        },
      }}
    />
  );
}
