// Pure matching for the member picker (member-combobox.tsx), kept out of the
// client component so it can be unit tested.

type SearchableMember = { fullName: string; email: string };

// Lower case, accents stripped: "Niccolò" and "niccolo" compare equal.
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Every word of the query must appear somewhere in the name or the email, in
// any order: "rossi mario" finds "Mario Rossi". Input order is kept.
export function filterMembers<T extends SearchableMember>(members: ReadonlyArray<T>, query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...members];
  return members.filter((m) => {
    const haystack = `${fold(m.fullName)} ${fold(m.email)}`;
    return words.every((w) => haystack.includes(w));
  });
}
