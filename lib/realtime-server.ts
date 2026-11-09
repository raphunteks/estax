import Pusher from "pusher";

type SseSubscriber = (rev: number) => void;
const subscribers = new Set<SseSubscriber>();

/** Registers an active SSE client stream to receive realtime revision pushes. */
export function subscribeSse(cb: SseSubscriber): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Delivers revision push to all active local SSE streams. */
export function notifySse(rev: number) {
  for (const cb of subscribers) {
    try {
      cb(rev);
    } catch {
      subscribers.delete(cb);
    }
  }
}

let pusherClient: Pusher | null = null;
function getPusher(): Pusher | null {
  if (pusherClient) return pusherClient;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

  if (appId && key && secret) {
    pusherClient = new Pusher({ appId, key, secret, cluster, useTLS: true });
    return pusherClient;
  }
  return null;
}

/**
 * Broadcasts a database revision change to all connected clients:
 * 1. Pushes to active Server-Sent Events (SSE) connections.
 * 2. Pushes to Pusher channel 'estaka-live' (if Pusher credentials are configured).
 */
export async function broadcastRev(rev: number) {
  // 1. Native Server-Sent Events push (zero configuration)
  notifySse(rev);

  // 2. Pusher realtime push (if configured in env)
  const pusher = getPusher();
  if (pusher) {
    try {
      await pusher.trigger("estaka-live", "rev", { rev });
    } catch (err) {
      console.error("[realtime] Pusher broadcast error:", err);
    }
  }
}

