import { describe, expect, it } from "vitest";
import { GROUP_INFO_SLUG, normalizeGroupInfo, parseGroupInfo } from "./group-info";
import { buildSearchIndex, groupInfoSearchEntry, searchGuide } from "./search";

describe("normalizeGroupInfo", () => {
  it("drops Windows line ends, trailing spaces and extra blank lines", () => {
    expect(normalizeGroupInfo("  Ritiro giovedì  \r\n\r\n\r\n\r\nVia Roma 1 \n")).toBe("Ritiro giovedì\n\nVia Roma 1");
  });

  it("returns null when nothing is left", () => {
    expect(normalizeGroupInfo("")).toBeNull();
    expect(normalizeGroupInfo(" \n \r\n ")).toBeNull();
  });
});

describe("parseGroupInfo", () => {
  it("splits paragraphs on a blank line and keeps line breaks", () => {
    const blocks = parseGroupInfo("Riga uno\nRiga due\n\nSecondo");
    expect(blocks).toEqual([
      [[{ kind: "text", value: "Riga uno" }], [{ kind: "text", value: "Riga due" }]],
      [[{ kind: "text", value: "Secondo" }]],
    ]);
  });

  it("reads **bold** and leaves an unpaired mark as typed", () => {
    expect(parseGroupInfo("Il **giovedì** alle 18 ** circa")[0][0]).toEqual([
      { kind: "text", value: "Il " },
      { kind: "bold", value: "giovedì" },
      { kind: "text", value: " alle 18 ** circa" },
    ]);
  });

  it("links web and email addresses, leaving the sentence's punctuation out", () => {
    expect(parseGroupInfo("Scrivi a cassa@esempio.it, o vedi www.esempio.it/orari.")[0][0]).toEqual([
      { kind: "text", value: "Scrivi a " },
      { kind: "link", value: "cassa@esempio.it", href: "mailto:cassa@esempio.it" },
      { kind: "text", value: ", o vedi " },
      { kind: "link", value: "www.esempio.it/orari", href: "https://www.esempio.it/orari" },
      { kind: "text", value: "." },
    ]);
    expect(parseGroupInfo("**https://esempio.it/a?b=1**")[0][0]).toEqual([
      { kind: "link", value: "https://esempio.it/a?b=1", href: "https://esempio.it/a?b=1" },
    ]);
  });

  it("never links a script address", () => {
    const segments = parseGroupInfo("javascript:alert(1) data:text/html,x")[0][0];
    expect(segments.every((s) => s.kind === "text")).toBe(true);
  });
});

describe("group info in the guide's search", () => {
  it("comes before the generic cards on its own words", () => {
    const index = [
      groupInfoSearchEntry("Il nostro gruppo", "Il ritiro è il giovedì"),
      ...buildSearchIndex([{ slug: "quando", topic: "ordinare", title: "Quando si ritira", intro: "Il ritiro" }]),
    ];
    expect(searchGuide(index, "ritiro", { synonyms: [], stopwords: [] })[0].entry.slug).toBe(GROUP_INFO_SLUG);
  });

  it("is found by its words and opens the card on the index", () => {
    const index = [
      groupInfoSearchEntry("Il nostro gruppo", "Il **ritiro** è il giovedì in via Roma"),
      ...buildSearchIndex([]),
    ];
    const results = searchGuide(index, "ritiro giovedi", { synonyms: [], stopwords: [] });
    expect(results.map((r) => r.entry.href)).toEqual([`/guida#${GROUP_INFO_SLUG}`]);
  });
});
