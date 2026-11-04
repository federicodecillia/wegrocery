import Link from "next/link";

// A section of Home: a readable heading (sentence case, not a small caps
// label: many members are older), an optional link on its right, then its
// content. The heading names the section for screen readers.
export function HomeSection({
  id,
  title,
  action,
  children,
  className = "",
}: {
  id: string;
  title: string;
  /** `mobileOnly`: hidden from lg, where the month card carries the same link. */
  action?: { href: string; label: string; mobileOnly?: boolean };
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `home-${id}`;
  return (
    <section aria-labelledby={headingId} className={`mb-6 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-[17px] font-extrabold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className={`flex min-h-11 items-center text-[14px] font-semibold text-primary-text ${action.mobileOnly ? "lg:hidden" : ""}`}
          >
            {action.label} <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
