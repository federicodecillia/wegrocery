import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Named for their role, not their colour, so a brand palette never makes a
 * name lie: `brand` and `accent` take the brand's fills, `neutral` is the dark
 * button, `danger` the destructive one.
 */
export type ButtonVariant = "neutral" | "brand" | "accent" | "danger" | "outline" | "ghost";

export type ButtonSize = "sm" | "md";

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyle {}

const base =
  "pressable inline-flex items-center justify-center rounded-full font-sans font-bold tracking-tight select-none transition-[opacity,transform] duration-150 disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  neutral: "bg-brand-near-black text-white",
  brand: "bg-primary text-on-primary",
  accent: "bg-accent text-on-accent",
  danger: "bg-brand-red text-white",
  outline: "bg-transparent border border-brand-border text-brand-near-black",
  ghost: "bg-transparent text-brand-near-black hover:bg-black/[0.04]",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-12 px-[22px] py-[14px] text-sm",
  sm: "min-h-9 px-3 py-1.5 text-xs",
};

/** The button look, for a Link or an <a> that should read as a button. */
export function buttonClass({ variant = "neutral", size = "md", block }: ButtonStyle = {}, className?: string): string {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass({ variant, size, block }, className)} {...props} />;
});
