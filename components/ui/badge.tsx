import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "accent" | "brand" | "danger" | "neutral";

const tones: Record<BadgeTone, string> = {
  accent: "border-accent/20 bg-accent-bg text-accent-text",
  brand: "border-primary-mid bg-primary-bg text-primary-text",
  danger: "border-destructive/20 bg-danger-bg text-destructive",
  neutral: "border-border bg-tint/[0.04] text-secondary-foreground",
};

/** A status, not a control: never clickable (a filter or a link is a Chip or a button). */
export function Badge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: BadgeTone;
  /** A small dot before the label, for live states ("Aperto"). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 tabular-nums text-label font-semibold",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />}
      {children}
    </span>
  );
}
