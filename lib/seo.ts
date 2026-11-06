import type { Metadata } from "next";
import { clinic, doctors, faq as faqCopy } from "@/lib/content";
import { SCHEDULE } from "@/lib/schedule";

/** One entry per section page. Titles stay under ~60 characters and descriptions within 70-160 for search snippets. */
export const PAGES = {
  dokter: { path: "/dokter", name: "Dokter", title: "Dokter Gigi Umum dan Spesialis", h1: "Tim dokter gigi Estaka Dental Clinic", description: "Kenali dokter gigi umum dan dokter gigi spesialis konservasi Estaka Dental Clinic di Makassar. Lihat fokus perawatan tiap dokter dan buat janji online." },
  layanan: { path: "/layanan", name: "Layanan", title: "Layanan Dokter Gigi di Makassar", h1: "Layanan Estaka Dental Clinic", description: "Layanan gigi di Makassar: pemeriksaan, pembersihan karang gigi, tambal gigi, dan perawatan saluran akar oleh dokter gigi umum dan spesialis." },
  teknologi: { path: "/teknologi", name: "Teknologi", title: "Teknologi Klinik Gigi", h1: "Teknologi di Estaka Dental Clinic", description: "Teknologi yang membantu dokter menjelaskan kondisi gigi dan merencanakan perawatan dengan lebih jelas bagi pasien di Estaka Dental Clinic Makassar." },
  biaya: { path: "/biaya", name: "Biaya", title: "Estimasi Biaya Perawatan Gigi", h1: "Estimasi biaya perawatan gigi", description: "Estimasi biaya perawatan gigi di Estaka Dental Clinic Makassar. Biaya akhir dijelaskan di awal setelah pemeriksaan dokter." },
  faq: { path: "/faq", name: "FAQ", title: "Pertanyaan Umum Perawatan Gigi", h1: "Pertanyaan yang sering ditanyakan", description: "Jawaban atas pertanyaan umum: kunjungan pertama, janji temu, rasa sakit saat perawatan, perawatan saluran akar, dan perubahan jadwal di Estaka Dental Clinic." },
  lokasi: { path: "/lokasi", name: "Lokasi", title: "Lokasi dan Jam Praktik", h1: "Lokasi dan jam praktik", description: "Alamat, peta, dan jam praktik Estaka Dental Clinic di Jl. Andi Tonro, Tamalate, Makassar. Senin sampai Sabtu pukul 09:00 sampai 17:00 WITA." },
  reservasi: { path: "/reservasi", name: "Reservasi", title: "Reservasi Janji Dokter Gigi", h1: "Reservasi janji temu", description: "Atur jadwal kunjungan ke dokter gigi di Estaka Dental Clinic Makassar dalam tiga langkah singkat. Tim kami mengonfirmasi melalui WhatsApp." },
} as const;
export type PageKey = keyof typeof PAGES;

const abs = (p: string) => new URL(p, clinic.siteUrl).toString();

export function pageMetadata(k: PageKey): Metadata {
  const p = PAGES[k];
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: { title: `${p.title} | ${clinic.name}`, description: p.description, url: p.path, type: "website", locale: "id_ID", siteName: clinic.name, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: clinic.name }] },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: ["/opengraph-image"] },
  };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Dentist (LocalBusiness) entity. Only fields with real data are emitted. */
export function dentistLd(o: { address?: string; phone?: string; instagram?: string } = {}) {
  const address = o.address || clinic.address;
  const phone = o.phone || clinic.phone;
  return {
    "@context": "https://schema.org",
    "@type": "Dentist",
    "@id": abs("/#clinic"),
    name: clinic.name,
    url: abs("/"),
    image: abs("/opengraph-image"),
    ...(phone && { telephone: phone }),
    ...(address && { address: { "@type": "PostalAddress", streetAddress: address, addressLocality: "Makassar", addressRegion: "Sulawesi Selatan", addressCountry: "ID" } }),
    geo: { "@type": "GeoCoordinates", latitude: clinic.geo.lat, longitude: clinic.geo.lng },
    areaServed: { "@type": "City", name: "Makassar" },
    medicalSpecialty: ["Dentistry", "Endodontics"],
    ...((o.instagram || clinic.instagram) && { sameAs: [o.instagram || clinic.instagram] }),
    openingHoursSpecification: SCHEDULE.openDays.map((d) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[d], opens: SCHEDULE.slots[0], closes: "17:00" })),
  };
}

export const breadcrumbLd = (k: PageKey) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Beranda", item: abs("/") },
    { "@type": "ListItem", position: 2, name: PAGES[k].name, item: abs(PAGES[k].path) },
  ],
});

export const faqLd = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqCopy.items.map((i) => ({ "@type": "Question", name: i.q.id, acceptedAnswer: { "@type": "Answer", text: i.a.id } })),
});

export const doctorsLd = () => ({
  "@context": "https://schema.org",
  "@graph": doctors.map((d) => ({ "@type": "Physician", name: d.name, medicalSpecialty: "Dentistry", description: d.role.id, worksFor: { "@id": abs("/#clinic") } })),
});

export const LD_JSON = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
