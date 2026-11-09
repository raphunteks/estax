"use client";

import { L } from "./L";
import { Head } from "./Head";
import { clinic, location, pricing, treatments } from "@/lib/content";
import { waLink } from "@/lib/wa";
import { useSite } from "@/lib/site-context";
import { mapEmbedSrc } from "@/lib/site-helpers";
import { useLang } from "@/lib/lang";

const wrap = "mx-auto max-w-6xl px-4 sm:px-6";
const sec = "py-24 sm:py-32";

export function Pricing() {
  const lang = useLang();
  const isEn = lang === "en";
  const ask = waLink(isEn ? "Hello Estaka Dental Clinic, I would like to ask about treatment estimates." : "Halo Estaka Dental Clinic, saya ingin menanyakan estimasi biaya perawatan.");
  return (
    <section id="pricing" className={`${sec} bg-surface`}>
      <div className={wrap}>
        <Head eyebrow={pricing.eyebrow} title={pricing.title} sub={pricing.note} />
        <ul className="mt-12 divide-y divide-line rounded-3xl border border-line" data-reveal>
          {treatments.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
              <span className="font-medium">
                <L v={t.label} />
              </span>
              <span className="text-sm text-muted">{t.price ? <L v={t.price} /> : <a href={ask ?? "/reservasi"} className="text-accent underline-offset-4 hover:underline" {...(ask ? { target: "_blank", rel: "noopener noreferrer" } : {})}><L v={pricing.ask} /></a>}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Location() {
  const lang = useLang();
  const isEn = lang === "en";
  const site = useSite().clinic;
  const wa = waLink(undefined, site.whatsapp);
  const address = site.address || clinic.address;
  const phone = site.phone || clinic.phone;
  const mapsUrl = site.mapsUrl || clinic.mapsUrl;
  const embed = mapEmbedSrc(site, clinic.address);
  return (
    <section id="location" className={`${sec} bg-surface`}>
      <div className={`${wrap} grid items-start gap-10 lg:grid-cols-2`}>
        <div className="space-y-6" data-reveal>
          <Head eyebrow={location.eyebrow} title={location.title} />
          <p className="text-lg">{address ?? <span className="text-muted"><L v={location.addressMissing} /></span>}</p>
          <ul className="space-y-2 text-sm">
            {clinic.hours.map((h, i) => (
              <li key={i} className="flex justify-between gap-6 border-b border-line pb-2">
                <span>
                  <L v={h.days} />
                </span>
                <span className="text-muted">{typeof h.time === "string" ? h.time : <L v={h.time} />}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            {mapsUrl && (
              <a className="btn btn-ghost" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <L v={location.directions} />
              </a>
            )}
            {phone && (
              <a className="btn btn-ghost" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                <L v={location.call} />
              </a>
            )}
            {wa && (
              <a className="btn btn-primary" href={wa} target="_blank" rel="noopener noreferrer">
                <L v={location.whatsapp} />
              </a>
            )}
          </div>
        </div>
        {embed && (
          <div data-reveal>
            <iframe title={isEn ? "Clinic location map" : "Peta lokasi klinik"} src={embed} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="aspect-[16/10] max-h-[300px] w-full rounded-3xl sm:max-h-[340px] border border-line" />
          </div>
        )}
      </div>
    </section>
  );
}

export function WhatsAppFab({ number }: { number?: string }) {
  const lang = useLang();
  const isEn = lang === "en";
  const wa = waLink(isEn ? "Hello Estaka Dental Clinic, I have a question." : "Halo Estaka Dental Clinic, saya ingin bertanya.", number);
  if (!wa) return null;
  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="pulse-ring fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-1.9 1.3-.5.1-1.1.1-3-.6-2.5-1-4.1-3.5-4.2-3.7-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.4-.4.4c-.1.2-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.2 1.3.3.1.4.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.5Z" />
      </svg>
    </a>
  );
}
