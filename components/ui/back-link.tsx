import Link from "next/link";
import { cn } from "@/lib/utils";

/** "← Where you came from", at the top of a sub-page. */
export function BackLink({ href, children, className }: { href: string; children: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "-ml-1 inline-flex min-h-11 items-center gap-1 rounded-full px-1 label-caps font-bold text-brand-gray hover:text-brand-near-black",
        className,
      )}
    >
      <span aria-hidden>←</span> {children}
    </Link>
  );
}
