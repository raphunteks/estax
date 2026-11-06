import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const BOOKINGS_KEY = "estaka:bookings";
export const bookingKey = (id: string) => `estaka:booking:${id}`;

export function hasRedis(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let redis: Redis | null = null;
export function getRedis(): Redis {
  redis ??= Redis.fromEnv();
  return redis;
}

const limiters = new Map<string, Ratelimit>();
export function getLimiter(name: string, tokens: number, window: `${number} ${"s" | "m" | "h"}`): Ratelimit {
  let l = limiters.get(name);
  if (!l) {
    l = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `estaka:rl:${name}`,
    });
    limiters.set(name, l);
  }
  return l;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
