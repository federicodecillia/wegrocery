import { describe, expect, it } from "vitest";
import { filterMembers } from "./member-search";

const members = [
  { memberId: "mem_1", fullName: "Mario Rossi", email: "mario.rossi@example.org" },
  { memberId: "mem_2", fullName: "Niccolò Bianchi", email: "nbianchi@example.org" },
  { memberId: "mem_3", fullName: "Anna Verdi", email: "anna@verdi.example" },
];

const ids = (list: ReadonlyArray<{ memberId: string }>) => list.map((m) => m.memberId);

describe("filterMembers", () => {
  it("returns every member, in order, for a blank query", () => {
    expect(ids(filterMembers(members, ""))).toEqual(["mem_1", "mem_2", "mem_3"]);
    expect(ids(filterMembers(members, "   "))).toEqual(["mem_1", "mem_2", "mem_3"]);
  });

  it("matches the name regardless of case", () => {
    expect(ids(filterMembers(members, "ROSSI"))).toEqual(["mem_1"]);
  });

  it("matches the email", () => {
    expect(ids(filterMembers(members, "verdi.example"))).toEqual(["mem_3"]);
    expect(ids(filterMembers(members, "nbianchi@"))).toEqual(["mem_2"]);
  });

  it("ignores accents on either side", () => {
    expect(ids(filterMembers(members, "niccolo"))).toEqual(["mem_2"]);
    expect(ids(filterMembers([{ memberId: "x", fullName: "Nicolo", email: "" }], "nicolò"))).toEqual(["x"]);
  });

  it("needs every word, in any order, across name and email", () => {
    expect(ids(filterMembers(members, "rossi mario"))).toEqual(["mem_1"]);
    expect(ids(filterMembers(members, "anna verdi.example"))).toEqual(["mem_3"]);
    expect(ids(filterMembers(members, "mario verdi"))).toEqual([]);
  });

  it("keeps the input order of the matches", () => {
    expect(ids(filterMembers(members, "example"))).toEqual(["mem_1", "mem_2", "mem_3"]);
  });
});
