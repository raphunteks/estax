/** Minimal single-page PDF writer (Helvetica, text and rules only). No dependencies. */
type Op = { x: number; y: number; text: string; size?: number; bold?: boolean; right?: boolean } | { rule: [number, number, number, number] };
const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
const W = { reg: 0.5, bold: 0.56 }; // average glyph width per em, used only for right alignment

export function pdf(ops: Op[], size: [number, number] = [420, 595]): Buffer {
  const body = ops.map((o) => {
    if ("rule" in o) { const [a, b, c, d] = o.rule; return `0.6 w ${a} ${b} m ${c} ${d} l S`; }
    const sz = o.size ?? 10;
    const x = o.right ? o.x - o.text.length * sz * (o.bold ? W.bold : W.reg) : o.x;
    return `BT /${o.bold ? "F2" : "F1"} ${sz} Tf ${x.toFixed(1)} ${o.y} Td (${esc(o.text)}) Tj ET`;
  }).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size[0]} ${size[1]}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n";
  const off: number[] = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
