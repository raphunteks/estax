# Estaka Dental Clinic

Next.js 16 (App Router) + TypeScript + Tailwind v4 + GSAP (`useGSAP`, ScrollTrigger). Booking is stored in Upstash Redis. Deploy on Vercel.

## Run

```bash
npm install
cp .env.example .env.local   # fill values, never commit
npm run dev
```

Checks: `npm run typecheck && npm run lint && npm run build`

## Before launch (TODO)

1. `lib/content.ts`: real doctor names and titles, bios, treatments, prices (leave `price` empty to show "ask for estimate").
2. Doctor photos: put files in `public/doctors/` and set `photo: "/doctors/xxx.webp"` per doctor (3:4, under 150 KB).
3. `lib/schedule.ts` and `clinic.hours`: confirm opening days, slots, and closing time (also used by JSON-LD in `app/page.tsx`).
4. `.env.local` / Vercel env: WhatsApp number, phone, address, Maps URL, site URL, Upstash URL and token, `ADMIN_PASSWORD`.
5. Enable more specialties in `specialties` only when the clinic really offers them.
6. Optional: add `public/media/hero.mp4` (with poster) if you want video in the hero.
7. Review every sentence yourself (medical claims, patient privacy text).

## Notes

- Bookings: `POST /api/booking` (zod validation, honeypot, rate limit 5 per 10 min per IP). Without Upstash env it returns 503 and the UI offers the WhatsApp fallback.
- Admin: `/admin` (HTTP Basic auth via `ADMIN_USER` / `ADMIN_PASSWORD`), lists bookings, delete button per row. Data is kept until deleted manually.
- Language (ID/EN) and theme (dark/light) are client toggles on one URL. For separate indexable English pages, move to `/en` routes later.
- Motion: GSAP only. All animation is skipped when `prefers-reduced-motion: reduce`.
