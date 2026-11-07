import { Fragment } from "react";
import { parseGroupInfo, type GroupInfoSegment } from "@/lib/guide/group-info";

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

// A text an admin typed, in the format of "Il nostro gruppo"
// (lib/guide/group-info.ts): paragraphs, line breaks, **bold**, links.
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className ?? "space-y-3"}>
      {parseGroupInfo(text).map((lines, i) => (
        <p key={i} className="text-[15px] leading-[1.5] text-foreground">
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
  );
}
