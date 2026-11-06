import { z } from "zod";

/** Shared by the Odontogram UI and the server validators. Code meanings follow docs/RME-PLAN.md section 8 (NON confirmed, rest to be reviewed by the clinic). */
export const SURFACES = ["o", "m", "d", "b", "l"] as const;
export type Surface = (typeof SURFACES)[number];
export const SURFACE_LABEL: Record<Surface, string> = { o: "Oklusal/Insisal", m: "Mesial", d: "Distal", b: "Bukal/Fasial", l: "Lingual/Palatal" };

type Def = { id: string; whole: boolean; group: string };
export const CODES = {
  SOU: { id: "Sehat", whole: false, group: "Kondisi" },
  NON: { id: "Gigi tidak ada", whole: true, group: "Kondisi" },
  UNE: { id: "Belum erupsi", whole: true, group: "Kondisi" },
  PRE: { id: "Erupsi sebagian", whole: true, group: "Kondisi" },
  IMV: { id: "Impaksi", whole: true, group: "Kondisi" },
  ANO: { id: "Anomali", whole: true, group: "Kondisi" },
  DIA: { id: "Diastema", whole: false, group: "Kondisi" },
  ATT: { id: "Atrisi", whole: false, group: "Kondisi" },
  ABR: { id: "Abrasi", whole: false, group: "Kondisi" },
  CFR: { id: "Fraktur mahkota", whole: true, group: "Kondisi" },
  NVT: { id: "Non-vital", whole: true, group: "Kondisi" },
  RRX: { id: "Sisa akar", whole: true, group: "Kondisi" },
  MIS: { id: "Hilang", whole: true, group: "Kondisi" },
  CAR: { id: "Karies", whole: false, group: "Kondisi" },
  AMF: { id: "Tumpatan amalgam", whole: false, group: "Restorasi" },
  GIF: { id: "Tumpatan glass ionomer", whole: false, group: "Restorasi" },
  COF: { id: "Tumpatan komposit", whole: false, group: "Restorasi" },
  FIS: { id: "Fissure sealant", whole: false, group: "Restorasi" },
  INL: { id: "Inlay", whole: false, group: "Restorasi" },
  ONL: { id: "Onlay", whole: false, group: "Restorasi" },
  FMC: { id: "Mahkota logam penuh", whole: true, group: "Protesa" },
  POC: { id: "Mahkota porselen", whole: true, group: "Protesa" },
  MPC: { id: "Mahkota logam-porselen", whole: true, group: "Protesa" },
  GMC: { id: "Mahkota emas", whole: true, group: "Protesa" },
  RCT: { id: "Perawatan saluran akar", whole: true, group: "Perawatan" },
  IPX: { id: "Implan", whole: true, group: "Protesa" },
  MEB: { id: "Bridge logam", whole: true, group: "Protesa" },
  POB: { id: "Bridge porselen", whole: true, group: "Protesa" },
  PON: { id: "Pontik", whole: true, group: "Protesa" },
  ABU: { id: "Abutment", whole: true, group: "Protesa" },
  PRD: { id: "Gigi tiruan sebagian lepasan", whole: true, group: "Protesa" },
  FLD: { id: "Gigi tiruan penuh", whole: true, group: "Protesa" },
  ACR: { id: "Akrilik", whole: true, group: "Protesa" },
} satisfies Record<string, Def>;
export type Code = keyof typeof CODES;
export const CODE_KEYS = Object.keys(CODES) as Code[];
/** Display tone per code (token names, resolved in CSS). */
export const TONE: Partial<Record<Code, "bad" | "ok" | "info" | "muted">> = { CAR: "bad", CFR: "bad", RRX: "bad", NVT: "bad", AMF: "ok", GIF: "ok", COF: "ok", FIS: "ok", INL: "ok", ONL: "ok", RCT: "info", FMC: "info", POC: "info", MPC: "info", GMC: "info", IPX: "info", NON: "muted", MIS: "muted", UNE: "muted" };

export const PERMANENT = [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28], [48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]].map((q) => q.map(String));
export const PRIMARY = [[55, 54, 53, 52, 51], [61, 62, 63, 64, 65], [85, 84, 83, 82, 81], [71, 72, 73, 74, 75]].map((q) => q.map(String));
export const ALL_TEETH = new Set([...PERMANENT.flat(), ...PRIMARY.flat()]);

const code = z.enum(CODE_KEYS as [Code, ...Code[]]);
export const toothSchema = z.object({ w: code.optional(), s: z.partialRecord(z.enum(SURFACES), code).optional() });
export const odoSchema = z.object({ teeth: z.record(z.string(), toothSchema).refine((t) => Object.keys(t).every((k) => ALL_TEETH.has(k)), "invalid tooth") });
export type Odo = z.infer<typeof odoSchema>;
export const emptyOdo = (): Odo => ({ teeth: {} });

/** Auto-generated result text, one line per tooth. */
export function describe(o: Odo): string[] {
  const order = [...PERMANENT.flat(), ...PRIMARY.flat()];
  return order.flatMap((t) => {
    const x = o.teeth[t];
    if (!x) return [];
    const parts: string[] = [];
    if (x.w) parts.push(CODES[x.w].id);
    const by = new Map<Code, string[]>();
    for (const s of SURFACES) {
      const c = x.s?.[s];
      if (c) by.set(c, [...(by.get(c) ?? []), s.toUpperCase()]);
    }
    by.forEach((ss, c) => parts.push(`${CODES[c].id} (${ss.join(",")})`));
    return parts.length ? [`Gigi ${t}: ${parts.join("; ")}`] : [];
  });
}

/** Teeth whose record differs between two odontograms (compare mode). */
export function diff(a: Odo, b: Odo): string[] {
  const ids = new Set([...Object.keys(a.teeth), ...Object.keys(b.teeth)]);
  return [...ids].filter((t) => JSON.stringify(a.teeth[t] ?? null) !== JSON.stringify(b.teeth[t] ?? null));
}
