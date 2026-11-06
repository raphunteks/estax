import { readObject } from "@/lib/storage";

/** Public landing images only (key is a random name we generated; nothing else is readable through this route). */
export async function GET(_: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!/^[a-z0-9]{6,40}\.webp$/.test(key)) return new Response("Not found", { status: 404 });
  const o = await readObject(`site/${key}`);
  if (!o) return new Response("Not found", { status: 404 });
  return new Response(o.body, { headers: { "Content-Type": o.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
