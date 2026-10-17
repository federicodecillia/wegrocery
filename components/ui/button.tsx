"use client";

import { forwardRef } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * shadcn's Button on Base UI (Playbook 2.7). Variants are named for their
 * role, not their colour, so a brand palette never makes a name lie:
 * `default` is the dark button, `brand` and `accent` take the brand's fills,
 * `destructive` the destructive one.
 */
export const buttonVariants = cva(
  "pressable inline-flex items-center justify-center rounded-full font-sans font-bold tracking-tight select-none transition-[opacity,transform] duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "bg-inverse text-inverse-foreground",
        brand: "bg-primary text-primary-foreground",
        accent: "bg-accent text-accent-foreground",
        destructive: "bg-danger text-danger-foreground",
        outline: "bg-transparent border border-border text-foreground",
        ghost: "bg-transparent text-foreground hover:bg-tint/[0.04]",
      },
      size: {
        default: "min-h-12 px-5.5 py-3.5 text-sm",
        sm: "min-h-(--control-h) px-3 py-1.5 text-xs",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export interface ButtonProps
  extends Omit<ButtonPrimitive.Props, "className">,
    VariantProps<typeof buttonVariants> {
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, type = "button", ...props },
  ref,
) {
  return (
    <ButtonPrimitive
      ref={ref}
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
});
