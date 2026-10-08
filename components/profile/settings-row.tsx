import Link from "next/link";
import type { ReactNode } from "react";

// One line of the Profile page (app/profilo): a title, its current state
// underneath, and a chevron when it leads somewhere. At least 44px tall.

export const profileCard =
  "overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-brand-border";

const rowClass = "flex min-h-[52px] items-center gap-3 px-4 py-[12px]";

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
        <div className="flex items-center gap-2 text-[14px] font-bold text-brand-near-black">
          <span className="min-w-0 break-words">{title}</span>
          {badge && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand-red" />}
        </div>
        {detail != null && <div className="mt-[2px] break-words text-[12px] leading-snug text-brand-gray">{detail}</div>}
      </div>
      {chevron && (
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m9 18 6-6-6-6" />
        </svg>
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
  const hover = "transition-colors hover:bg-black/[0.02] focus-visible:bg-black/[0.03]";
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
    <section className="mb-[18px]">
      <h2 className="mb-[6px] px-1 font-mono text-label font-bold uppercase tracking-widest text-brand-gray">{title}</h2>
      <div className={profileCard}>{children}</div>
    </section>
  );
}
