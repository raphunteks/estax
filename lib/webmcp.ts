import { clinic, doctors, specialties } from "@/lib/content";

type Tool = { name: string; title: string; description: string; inputSchema: object; annotations?: object; execute: (args: Record<string, unknown>) => Promise<string> | string };
type Ctx = { registerTool: (t: Tool, o?: { signal?: AbortSignal }) => unknown };

const SECTIONS = ["doctors", "specialties", "technology", "pricing", "faq", "location", "reservasi"];
const clean = (s: string) => s.replace(/\*/g, "");

/** Registers read-only WebMCP tools when the browser supports them. Returns a cleanup function. */
export function registerWebMcp(): () => void {
  const ctrl = new AbortController();
  try {
    const ctx = ((document as unknown as { modelContext?: Ctx }).modelContext ?? (navigator as unknown as { modelContext?: Ctx }).modelContext) as Ctx | undefined;
    if (!ctx?.registerTool) return () => ctrl.abort();
    const ro = { readOnlyHint: true };
    const empty = { type: "object", properties: {} };
    const tools: Tool[] = [
      { name: "get_doctors", title: "Daftar Dokter Gigi", description: "List the clinic's dentists and their specialties.", inputSchema: empty, annotations: ro, execute: () => doctors.map((d) => `${d.name} (${d.role.id})`).join("\n") },
      { name: "get_services", title: "Daftar Layanan Gigi", description: "List the dental services offered at Estaka Dental Clinic.", inputSchema: empty, annotations: ro, execute: () => specialties.filter((s) => s.enabled).map((s) => clean(s.title.id)).join("\n") },
      { name: "get_hours", title: "Jam Praktik Klinik", description: "Get clinic opening hours in WITA (UTC+8).", inputSchema: empty, annotations: ro, execute: () => clinic.hours.map((h) => `${h.days.id}: ${typeof h.time === "string" ? h.time : h.time.id}`).join("\n") },
      {
        name: "go_to_section",
        title: "Navigasi ke Bagian Halaman",
        description: "Scroll the page to a specific clinic section.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              title: "ID Bagian Halaman",
              description: "Target section ID on the page (doctors, specialties, technology, pricing, faq, location, or reservasi).",
              enum: SECTIONS,
            },
          },
          required: ["section"],
        },
        annotations: ro,
        execute: (a) => {
          const id = String(a.section);
          if (!SECTIONS.includes(id)) return "Unknown section";
          location.hash = id;
          return `Scrolled to ${id}`;
        },
      },
    ];
    tools.forEach((t) => ctx.registerTool(t, { signal: ctrl.signal }));
  } catch {
    /* WebMCP is optional */
  }
  return () => ctrl.abort();
}
