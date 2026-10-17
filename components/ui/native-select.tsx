import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";

export interface NativeSelectProps extends ComponentProps<"select"> {
  /** Layout for the wrapper (margins, flex, a fixed width); `className` styles the <select>. */
  wrapperClassName?: string;
}

/**
 * shadcn's NativeSelect (Playbook 2.7): a real <select>, so phones show their
 * own picker and FormData reads it, with the Input look and a lucide chevron
 * in place of the browser's arrow.
 * A caller that changes the padding keeps room for the chevron (pr-8 or more).
 */
export function NativeSelect({ className, wrapperClassName, ...props }: NativeSelectProps) {
  return (
    <div data-slot="native-select-wrapper" className={cn("relative w-full", wrapperClassName)}>
      <select data-slot="native-select" className={cn(fieldBase, "appearance-none pr-9", className)} {...props} />
      <ChevronDown
        aria-hidden
        data-slot="native-select-icon"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export function NativeSelectOption(props: ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}
