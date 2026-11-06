import { clinic, doctors, specialties } from "@/lib/content";

type Tool = { name: string; description: string; inputSchema: object; annotations?: object; execute: (args: Record<string, unknown>) => Promise<string> | string };
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
      { name: "get_doctors", description: "List the clinic's doctors and their roles.", inputSchema: empty, annotations: ro, execute: () => doctors.map((d) => `${d.name} (${d.role.id})`).join("\n") },
      { name: "get_services", description: "List the dental services offered.", inputSchema: empty, annotations: ro, execute: () => specialties.filter((s) => s.enabled).map((s) => clean(s.title.id)).join("\n") },
      { name: "get_hours", description: "Opening hours (WITA).", inputSchema: empty, annotations: ro, execute: () => clinic.hours.map((h) => `${h.days.id}: ${typeof h.time === "string" ? h.time : h.time.id}`).join("\n") },
      {
        name: "go_to_section",
        description: "Scroll the page to a section.",
        inputSchema: { type: "object", properties: { section: { type: "string", enum: SECTIONS } }, required: ["section"] },
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
