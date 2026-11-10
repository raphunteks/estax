/** Generates llms.txt, the ARD manifest and the agent skill from lib/content.ts. Run via `npm run gen:agent`. */
import { mkdirSync, writeFileSync } from "node:fs";
import { clinic, doctors, specialties, treatments, faq } from "../lib/content";

const base = clinic.siteUrl.replace(/\/$/, "");
const host = new URL(base).hostname;
const days = clinic.hours.map((h) => `${h.days.id}: ${typeof h.time === "string" ? h.time : h.time.id}`);
const docs = doctors.map((d) => `- ${d.name}: ${d.role.id}`);
const svc = specialties.filter((s) => s.enabled).map((s) => `- ${s.title.id.replace(/\*/g, "")}: ${s.text.id.replace(/\*/g, "")}`);
const tx = treatments.filter((t) => t.id !== "lainnya").map((t) => `- ${t.label.id}`);
const contact = [clinic.whatsapp && `- WhatsApp: https://wa.me/${clinic.whatsapp}`, clinic.address && `- Alamat: ${clinic.address}`, clinic.mapsUrl && `- Peta: ${clinic.mapsUrl}`, clinic.instagram && `- Instagram: ${clinic.instagram}`].filter(Boolean) as string[];

const llms = `# ${clinic.name}

> Klinik gigi dengan dokter gigi umum dan spesialis konservasi gigi. Pasien dapat membuat janji online, dan biaya akhir ditentukan setelah pemeriksaan.

## Halaman
- [Beranda](${base}/): profil klinik, dokter, layanan, biaya dan FAQ
- [Buat janji](${base}/#booking): formulir janji temu
- [Masuk pasien dan staf](${base}/masuk)
- [Daftar pasien baru](${base}/daftar)

## Jam praktik (WITA)
${days.map((d) => `- ${d}`).join("\n")}

## Dokter
${docs.join("\n")}

## Layanan
${[...svc, ...tx].join("\n")}

## Kontak
${contact.length ? contact.join("\n") : "- Kontak akan segera ditambahkan."}

## Optional
- [Agent skill](${base}/.well-known/agent-skills/estaka/SKILL.md)
`;

const skill = `---
name: estaka-dental-clinic
description: Informasi dan cara membuat janji di ${clinic.name} (dokter gigi umum dan spesialis konservasi gigi).
---

# ${clinic.name}

## Membuat janji
Buka ${base}/#booking, atau daftar sebagai pasien di ${base}/daftar lalu pilih dokter, tanggal dan jam di portal. Slot yang tersedia mengikuti jadwal dokter (zona waktu WITA). Pasien dapat membatalkan atau mengubah janji paling lambat 1 jam sebelum jadwal.

## Jam praktik
${days.map((d) => `- ${d}`).join("\n")}

## Dokter
${docs.join("\n")}

## Layanan
${[...svc, ...tx].join("\n")}

## Biaya
Estimasi dijelaskan di awal; biaya akhir ditentukan setelah pemeriksaan.

## Pertanyaan umum
${faq.items.map((q) => `- ${q.q.id}`).join("\n")}
`;

const ard = {
  specVersion: "0.91",
  entries: [
    {
      identifier: `urn:air:${host}:estaka:clinic-skill`,
      displayName: `${clinic.name}: informasi dan janji temu`,
      type: 'text/markdown; profile="urn:air:agent-skills"',
      url: `${base}/.well-known/agent-skills/estaka/SKILL.md`,
      description: "Jam praktik, dokter, layanan dan cara membuat janji di klinik gigi.",
      capabilities: ["clinic-info", "appointment-booking"],
      representativeQueries: ["Jam buka klinik gigi Estaka", "Cara membuat janji dokter gigi di Estaka", "Dokter gigi spesialis konservasi di Makassar"],
      trustManifest: {
        identity: base,
      },
    },
  ],
};

const aiCatalog = {
  specVersion: "1.0",
  entries: [
    {
      identifier: `urn:air:${host}:estaka:clinic-skill`,
      displayName: `${clinic.name}: informasi dan janji temu`,
      type: "text/markdown",
      url: `${base}/.well-known/agent-skills/estaka/SKILL.md`,
      description: "Jam praktik, dokter, layanan dan cara membuat janji di klinik gigi.",
      capabilities: ["clinic-info", "appointment-booking"],
      representativeQueries: ["Jam buka klinik gigi Estaka", "Cara membuat janji dokter gigi di Estaka", "Dokter gigi spesialis konservasi di Makassar"],
      trustManifest: {
        identity: base,
      },
    },
    {
      identifier: `urn:air:${host}:estaka:online-booking`,
      displayName: `${clinic.name}: reservasi janji temu online`,
      type: "text/html",
      url: `${base}/reservasi`,
      description: "Formulir reservasi janji temu dokter gigi online dengan dukungan WebMCP.",
      capabilities: ["appointment-booking", "doctor-schedule"],
      representativeQueries: ["Reservasi dokter gigi Estaka Dental Clinic", "Jadwal praktik dokter gigi Estaka Makassar", "Daftar periksa gigi online di Estaka"],
      trustManifest: {
        identity: base,
      },
    },
  ],
};

mkdirSync("public/.well-known/agent-skills/estaka", { recursive: true });
writeFileSync("public/llms.txt", llms);
writeFileSync("public/.well-known/agent-skills/estaka/SKILL.md", skill);
writeFileSync("public/.well-known/ard.json", JSON.stringify(ard, null, 2) + "\n");
writeFileSync("public/.well-known/ai-catalog.json", JSON.stringify(aiCatalog, null, 2) + "\n");
console.log("agent files written for", base);
