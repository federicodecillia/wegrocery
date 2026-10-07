// "Il nostro gruppo": the text the admins write in Impostazioni and the guide
// shows at its top (app_settings.group_info, drizzle/0030_group_info.sql).
// Pure, so it is unit tested and the guide's search can use it.
//
// The format is what an admin types without knowing any: paragraphs split by
// a blank line, line breaks kept, **bold**, and web addresses and email
// addresses made clickable. Nothing else is interpreted.

export const GROUP_INFO_MAX = 2000;

// Anchor of the card on /guida, also the search result's target.
export const GROUP_INFO_SLUG = "il-nostro-gruppo";

// The text as stored: Windows line ends and trailing spaces gone, at most one
// blank line between paragraphs, null when nothing is left.
export function normalizeGroupInfo(raw: string): string | null {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text : null;
}

export type GroupInfoSegment =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "link"; value: string; href: string };

// Paragraphs, each a list of lines, each a list of segments.
export type GroupInfoBlock = GroupInfoSegment[][];

const LINK = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

// Punctuation that ends a sentence rather than an address: "vedi
// https://x.it." links https://x.it.
const TRAILING = /[.,;:!?)\]'"»]+$/;

function linkSegments(text: string, bold: boolean): GroupInfoSegment[] {
  const out: GroupInfoSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index;
    const address = m[0].replace(TRAILING, "");
    if (start > last) out.push({ kind: bold ? "bold" : "text", value: text.slice(last, start) });
    const href = address.includes("@") && !/^https?:|^www\./.test(address)
      ? `mailto:${address}`
      : address.startsWith("www.")
        ? `https://${address}`
        : address;
    out.push({ kind: "link", value: address, href });
    last = start + address.length;
  }
  if (last < text.length) out.push({ kind: bold ? "bold" : "text", value: text.slice(last) });
  return out;
}

function lineSegments(line: string): GroupInfoSegment[] {
  // Same rule as the guide's cards: **bold** pairs, an unpaired ** stays as typed.
  const parts = line.split(/\*\*([^*]+)\*\*/g);
  return parts.flatMap((value, idx) => (value ? linkSegments(value, idx % 2 === 1) : []));
}

export function parseGroupInfo(text: string): GroupInfoBlock[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n").map(lineSegments))
    .filter((lines) => lines.some((l) => l.length > 0));
}
