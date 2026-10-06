import { splitInlineBold } from "@/lib/changelog";

// Guide text with **bold** for button and page names.
export function RichText({ text }: { text: string }) {
  return (
    <>
      {splitInlineBold(text).map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-bold">
            {p.value}
          </strong>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}
