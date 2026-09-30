import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "orange"
  | "teal"
  | "red"
  | "ghost"
  | "outline";

export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const base =
  "inline-flex items-center justify-center rounded-full font-sans font-bold tracking-tight cursor-pointer select-none transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-near-black text-white",
  orange: "bg-primary text-on-primary",
  teal: "bg-accent text-on-accent",
  red: "bg-brand-red text-white",
  ghost:
    "bg-transparent border border-brand-border text-brand-near-black font-mono text-label tracking-widest uppercase",
  outline: "bg-transparent border border-brand-border text-brand-near-black",
};

const sizes: Record<ButtonSize, string> = {
  md: "px-[22px] py-[14px] text-sm",
  sm: "px-3 py-1.5 text-xs",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      block,
      type = "button",
      ...props
    },
    ref
  ) {
    const isGhost = variant === "ghost";
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          base,
          variants[variant],
          // ghost has its own padding/font-size baked in
          !isGhost && sizes[size],
          isGhost && "px-[13px] py-[5px]",
          block && "w-full",
          className
        )}
        {...props}
      />
    );
  }
);
