import type { Bi } from "@/lib/content";

/** Renders `*word*` as an italic accent word. */
function rich(text: string) {
  return text.split("*").map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part));
}

/** Bilingual text. Both languages are server-rendered; CSS shows the active one. */
export function L({ v }: { v: Bi }) {
  return (
    <>
      <span data-l="id">{rich(v.id)}</span>
      <span data-l="en">{rich(v.en)}</span>
    </>
  );
}
