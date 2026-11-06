import type { MetadataRoute } from "next";
import { clinic } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/dashboard", "/portal"] }],
    sitemap: `${clinic.siteUrl}/sitemap.xml`,
  };
}
