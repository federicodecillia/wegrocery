import Link from "next/link";

// A section of Home: a small heading, an optional link on its right, then
// its content. Keeps the page in readable blocks.
export function HomeSection({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={`mb-6 ${className}`}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-mono text-label font-semibold uppercase tracking-[0.1em] text-secondary-foreground">{title}</h2>
        {action && (
          <Link href={action.href} className="flex min-h-11 items-center text-label font-bold text-primary-text">
            {action.label} <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
