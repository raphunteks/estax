/**
 * Dynamic domain and origin resolver for Estaka Dental Clinic.
 * Automatically adapts between local development, Vercel preview, and production environments.
 * Single source of truth for Relying Party ID, site URLs, emails, and WebAuthn.
 */

export function getBaseUrl(req?: Request | Headers | null): string {
  // If running in browser, always use current browser origin
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  // If request or headers provided, inspect incoming request
  if (req) {
    const headers = "headers" in req ? req.headers : req;
    const origin = headers.get("origin");
    if (origin && origin !== "null") {
      try {
        const u = new URL(origin);
        return u.origin;
      } catch {
        // invalid URL format, fall through
      }
    }

    const host = headers.get("x-forwarded-host") || headers.get("host");
    if (host) {
      const cleanHost = host.split(",")[0].trim();
      const proto = headers.get("x-forwarded-proto") || (cleanHost.includes("localhost") || cleanHost.includes("127.0.0.1") ? "http" : "https");
      return `${proto}://${cleanHost}`;
    }
  }

  // Environment variable cascade
  const custom = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (custom) return custom.replace(/\/$/, "");

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`.replace(/\/$/, "");
  }

  // Default permanent production URL for Estaka Dental Clinic
  // (Local dev only uses localhost when explicitly running on localhost via request headers or local window)
  return "https://estakadentalclinic.vercel.app";
}

/**
 * Resolves WebAuthn Relying Party configuration dynamically.
 * Guaranteed to never return null.
 */
export function getRelyingParty(req?: Request | Headers | null): { id: string; origin: string; name: string } {
  const base = getBaseUrl(req);
  try {
    const u = new URL(base);
    return {
      id: u.hostname,
      origin: u.origin,
      name: "Estaka Dental Clinic",
    };
  } catch {
    return {
      id: "estakadentalclinic.vercel.app",
      origin: "https://estakadentalclinic.vercel.app",
      name: "Estaka Dental Clinic",
    };
  }
}
