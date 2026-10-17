import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// One line of the Profile page (app/profilo): a title, its current state
// underneath, and a chevron when it leads somewhere. At least 44px tall.

export const profileCard =
  "overflow-hidden rounded-card border border-border bg-card shadow-card divide-y divide-border";

const rowClass = "flex min-h-[52px] items-center gap-3 px-4 py-3";

type RowProps = {
  title: ReactNode;
  detail?: ReactNode;
  // Internal path, or an external URL / mailto (opened outside the app).
  href?: string;
  // A small dot next to the title: something waits for an answer.
  badge?: boolean;
};

function Body({ title, detail, badge, chevron }: Omit<RowProps, "href"> & { chevron: boolean }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[14px] font-bold text-foreground">
          <span className="min-w-0 break-words">{title}</span>
          {badge && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-danger" />}
        </div>
        {detail != null && <div className="mt-0.5 break-words text-[12px] leading-snug text-secondary-foreground">{detail}</div>}
      </div>
      {chevron && (
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} />
      )}
    </>
  );
}

export function SettingsRow({ title, detail, href, badge }: RowProps) {
  if (!href) {
    return (
      <div className={rowClass}>
        <Body title={title} detail={detail} badge={badge} chevron={false} />
      </div>
    );
  }
  const hover = "transition-colors hover:bg-tint/[0.02] focus-visible:bg-tint/[0.03]";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={`${rowClass} ${hover}`}>
        <Body title={title} detail={detail} badge={badge} chevron />
      </Link>
    );
  }
  const external = !href.startsWith("mailto:");
  return (
    <a
      href={href}
      className={`${rowClass} ${hover}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <Body title={title} detail={detail} badge={badge} chevron />
    </a>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4.5">
      <h2 className="mb-1.5 px-1 font-mono text-label font-bold uppercase tracking-widest text-secondary-foreground">{title}</h2>
      <div className={profileCard}>{children}</div>
    </section>
  );
}
