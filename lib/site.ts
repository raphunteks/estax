import "server-only";
import { db } from "@/lib/db/store";
import { emptySite, siteSchema, type SiteContent } from "@/lib/site-types";

const KEY = "site:content";
/** Never throws: the public landing page must render even if the store is down. */
export async function getSite(): Promise<SiteContent> {
  try {
    const raw = await db().get<unknown>(KEY);
    const p = siteSchema.safeParse(raw);
    return p.success ? p.data : emptySite();
  } catch {
    return emptySite();
  }
}
export const saveSite = (c: SiteContent) => db().set(KEY, c);
