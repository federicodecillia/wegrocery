import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";

// shadcn's Textarea (Playbook 2.7): a plain <textarea> with the Input look.
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, className)} {...props} />;
}
