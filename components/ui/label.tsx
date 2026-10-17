import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The field caption: small, semibold, uppercase. For a caption inside a wrapping <label>, use it on a <span>. */
export const labelClass = "mb-1 block text-label font-semibold uppercase tracking-wide text-secondary-foreground";

// shadcn's Label (Playbook 2.7) in the app's caption look. A plain <label>:
// pass htmlFor, or wrap the field.
export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label data-slot="label" className={cn(labelClass, className)} {...props} />;
}
