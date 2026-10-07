import { Fragment } from "react";
import { t } from "@/lib/i18n";
import { GROUP_INFO_SLUG, parseGroupInfo, type GroupInfoSegment } from "@/lib/guide/group-info";

function Segment({ segment }: { segment: GroupInfoSegment }) {
  if (segment.kind === "bold") return <strong className="font-bold">{segment.value}</strong>;
  if (segment.kind === "text") return <>{segment.value}</>;
  const external = !segment.href.startsWith("mailto:");
  return (
    <a
      href={segment.href}
      className="break-words font-semibold text-primary-text underline underline-offset-2"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {segment.value}
    </a>
  );
}

// "Il nostro gruppo" at the top of /guida: what the admins wrote in
// Impostazioni (where and when to collect, who to ask, the group's rules).
// The id is the anchor a search result jumps to.
export function GroupInfoCard({ text }: { text: string }) {
  return (
    <section
      id={GROUP_INFO_SLUG}
      className="mb-6 scroll-mt-24 rounded-[18px] border border-accent bg-accent-soft p-[18px] target:ring-2 target:ring-accent/20"
    >
      <h2 className="mb-2 flex items-center gap-2 text-[16px] font-extrabold tracking-[-0.01em] text-brand-near-black">
        <span aria-hidden>🏠</span>
        {t.guide.groupTitle}
      </h2>
      <div className="space-y-3">
        {parseGroupInfo(text).map((lines, i) => (
          <p key={i} className="text-[14px] leading-[1.5] text-brand-near-black">
            {lines.map((segments, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {segments.map((segment, k) => (
                  <Segment key={k} segment={segment} />
                ))}
              </Fragment>
            ))}
          </p>
        ))}
      </div>
    </section>
  );
}
