import type { ComponentProps } from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

/**
 * The look every text-like field shares (Input, Textarea, NativeSelect):
 * the `input` border, computed for 3:1 on the page and on cards (WCAG
 * 1.4.11), a compact control height and token-only disabled and invalid
 * states. Focus is the global :focus-visible outline; under 640 px
 * app/globals.css raises the text to 16 px so iOS does not zoom.
 */
export const fieldBase =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-[14px] text-foreground min-h-(--control-h) placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background aria-invalid:border-destructive";

/**
 * shadcn's Input on Base UI (Playbook 2.7): a native <input> for text,
 * email, number, search, date, time, url, tel and password. Checkboxes,
 * radios, files, colours and hidden inputs stay plain <input>s.
 */
export function Input({ className, ...props }: ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      data-slot="input"
      className={typeof className === "function" ? (state) => cn(fieldBase, className(state)) : cn(fieldBase, className)}
      {...props}
    />
  );
}
