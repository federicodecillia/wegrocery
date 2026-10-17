import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn's Badge (Playbook 2.7). A status, not a control: never clickable
// (a filter or a link is a Chip or a button).
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 tabular-nums text-label font-semibold",
  {
    variants: {
      variant: {
        default: "border-border bg-tint/[0.04] text-secondary-foreground",
        brand: "border-primary-mid bg-primary-bg text-primary-text",
        accent: "border-accent/20 bg-accent-bg text-accent-text",
        destructive: "border-destructive/20 bg-danger-bg text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** A small dot before the label, for live states ("Aperto"). */
  dot?: boolean;
}

export function Badge({ variant, dot, children, className, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />}
      {children}
    </span>
  );
}
