import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// shadcn's Card (Playbook 2.7) on the app's own surface: one border, the soft
// card shadow and 18px padding per part. Plain elements, no Base UI part.

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn("bg-card rounded-card border border-border shadow-card mb-3.5", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-header" className={cn("p-4.5 border-b border-border", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn("p-4.5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-footer" className={cn("p-4.5 border-t border-border", className)} {...props} />;
}
