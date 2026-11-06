import { z } from "zod";

/** Editable site content (client-safe: types, schema, helpers). Stored by lib/site.ts. */
const s = (n: number) => z.string().trim().max(n);

export const siteSchema = z.object({
  clinic: z.object({ address: s(300).optional(), phone: s(30).optional(), whatsapp: s(20).optional(), mapsUrl: s(500).optional(), mapsQuery: s(300).optional(), mapsEmbed: z.string().max(2500).optional() }),
  team: z.array(z.object({ id: s(40), name: s(80), roleId: s(80), roleEn: s(80).optional(), photo: s(80).optional() })).max(24),
  results: z.array(z.object({ id: s(40), titleId: s(120), titleEn: s(120).optional(), before: s(80), after: s(80) })).max(12),
  testimonials: z.array(z.object({ id: s(40), quote: s(500), name: s(80), treatment: s(80).optional() })).max(12),
  wa: z.object({ enabled: z.boolean(), email: z.boolean().optional(), template: s(600), hoursBefore: z.number().int().min(1).max(72) }),
});
export type SiteContent = z.infer<typeof siteSchema>;
export * from "./site-helpers";
