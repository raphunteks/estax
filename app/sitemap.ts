import type { MetadataRoute } from "next";
import { clinic } from "@/lib/content";
import { PAGES } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: clinic.siteUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    ...Object.values(PAGES).map((p) => ({ url: new URL(p.path, clinic.siteUrl).toString(), lastModified, changeFrequency: "monthly" as const, priority: p.path === "/reservasi" ? 0.9 : 0.7 })),
    { url: new URL("/daftar", clinic.siteUrl).toString(), lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
