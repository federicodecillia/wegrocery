"use client";

import { toast as sonner, type ExternalToast } from "sonner";

// Errors and warnings must be read, not raced: they stay 8 s and carry a
// close button. Success and info keep the Toaster's short default. A call
// that passes its own duration (e.g. a longer Cassa notice) still wins.
const LASTING: ExternalToast = {
  duration: 8000,
  closeButton: true,
};

type Message = Parameters<typeof sonner.error>[0];

export const toast = Object.assign(
  (message: Message, data?: ExternalToast) => sonner(message, data),
  sonner,
  {
    error: (message: Message, data?: ExternalToast) => sonner.error(message, { ...LASTING, ...data }),
    warning: (message: Message, data?: ExternalToast) => sonner.warning(message, { ...LASTING, ...data }),
  },
);
