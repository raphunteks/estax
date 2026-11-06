import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { clinic } from "@/lib/content";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

// Self-hosted (Instrument Serif + Manrope, both OFL). No third-party font requests.
const display = localFont({
  src: [
    { path: "./fonts/instrument-serif-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
  preload: false,
});
const sans = localFont({
  src: "./fonts/manrope-var.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
  preload: false,
});

const description =
  "Estaka Dental Clinic: dokter gigi umum dan spesialis konservasi gigi dalam satu klinik. Buat janji online melalui WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(clinic.siteUrl),
  title: { default: "Estaka Dental Clinic | Dokter Gigi Umum dan Spesialis", template: "%s | Estaka Dental Clinic" },
  description,
  openGraph: { title: "Estaka Dental Clinic", description, url: "/", type: "website", locale: "id_ID", siteName: clinic.name },
  twitter: { card: "summary_large_image", title: "Estaka Dental Clinic", description },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  category: "health",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "Estaka", statusBarStyle: "default" },
  applicationName: "Estaka",
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#0a0d18" },
  ],
  viewportFit: "cover",
};

/** Runs before paint: theme, language, and the motion-enabled flag (no flash, no layout shift). */
const bootScript = `(function(){var d=document.documentElement,T={siang:1,malam:1,aren:1,pandan:1,sunrise:1},p='auto';try{var t=localStorage.getItem('theme');p=t==='light'?'siang':t==='dark'?'malam':T[t]?t:'auto';if(localStorage.getItem('lang')==='en'){d.dataset.lang='en';d.lang='en'}}catch(e){}var h=(new Date().getUTCHours()+8)%24,n=p==='auto'?(h>=5&&h<9?'sunrise':h>=9&&h<15?'siang':h>=15&&h<18?'aren':'malam'):p;d.dataset.theme=n;d.dataset.pref=p;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('js')})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth" data-theme="malam" data-pref="auto" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <link rel="ard" href="/.well-known/ard.json" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <PwaRegister />
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
