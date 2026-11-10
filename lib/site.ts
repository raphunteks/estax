import "server-only";
import { unstable_cache } from "next/cache";
import { Redis } from "@upstash/redis";
import { db } from "@/lib/db/store";
import { emptySite, siteSchema, type SiteContent } from "@/lib/site-types";

const KEY = "site:content";

let siteReader: Redis | null = null;
function readRawSite(): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    // Use cache: "default" (instead of @upstash/redis default "no-store") so ISR pages keep static caching.
    siteReader ??= new Redis({ url, token, cache: "default", enableTelemetry: false });
    return siteReader.get(KEY);
  }
  return db().get<unknown>(KEY);
}

/** Direct uncached read for the dashboard editor so edits always reflect the latest stored state. */
export async function getSiteFresh(): Promise<SiteContent> {
  try {
    const raw = await db().get<unknown>(KEY);
    const p = siteSchema.safeParse(raw);
    return p.success ? p.data : emptySite();
  } catch {
    return emptySite();
  }
}

/** Cached public read (revalidated every 60s or immediately via `site-content` tag when edited). Never throws. */
export const getSite: () => Promise<SiteContent> = unstable_cache(
  async () => {
    try {
      const raw = await readRawSite();
      const p = siteSchema.safeParse(raw);
      return p.success ? p.data : emptySite();
    } catch {
      return emptySite();
    }
  },
  ["site-content"],
  { tags: ["site-content"], revalidate: 60 },
);

export const saveSite = (c: SiteContent) => db().set(KEY, c);
