import { z } from "zod";
import { TREATMENT_IDS } from "./content";
import { SCHEDULE } from "./schedule";

/** Indonesian mobile numbers: 08xx..., 628xx..., +628xx... */
export const PHONE_RE = /^(?:\+?62|0)8\d{7,12}$/;

export const bookingSchema = z.object({
  treatment: z.enum(TREATMENT_IDS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.enum(SCHEDULE.slots),
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(PHONE_RE)),
  note: z.string().trim().max(200).optional().default(""),
  consent: z.literal(true),
  /** Honeypot: real users never fill this. */
  website: z.string().max(0).optional().default(""),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export type BookingRecord = {
  id: string;
  createdAt: string;
  treatment: BookingInput["treatment"];
  date: string;
  time: string;
  name: string;
  phone: string;
  note: string;
};

/** Normalise to international digits for wa.me (08xx -> 628xx). */
export function toWaDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  return d;
}
