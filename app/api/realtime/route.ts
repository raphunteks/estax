import { isResponse, requireAuth } from "@/lib/api";
import { currentRev } from "@/lib/db/store";
import { subscribeSse } from "@/lib/realtime-server";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) stream for True Realtime Push:
 * Pushes database revision increments to connected client tabs instantly (zero HTTP polling).
 */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let keepAlive: NodeJS.Timeout | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const initialRev = await currentRev();
        controller.enqueue(
          encoder.encode(`event: init\ndata: ${JSON.stringify({ rev: initialRev })}\n\n`)
        );

        cleanup = subscribeSse((rev: number) => {
          try {
            controller.enqueue(
              encoder.encode(`event: rev\ndata: ${JSON.stringify({ rev })}\n\n`)
            );
          } catch {
            // Stream closed
          }
        });

        // 25-second keep-alive to prevent intermediate reverse proxies or Vercel from timing out
        keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            clearInterval(keepAlive);
          }
        }, 25_000);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      if (cleanup) cleanup();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

