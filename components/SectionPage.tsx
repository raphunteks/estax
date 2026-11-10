import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Global from "@/components/Global";
import { L } from "@/components/L";
import { WhatsAppFab } from "@/components/Sections";
import { SiteProvider } from "@/lib/site-context";
import { getSite } from "@/lib/site";
import { LD_JSON, PAGES, breadcrumbLd, dentistLd, type PageKey } from "@/lib/seo";

/** Server-rendered shell for one landing section on its own URL: real HTML for crawlers, same section components as the home page. */
export default async function SectionPage({ page, children, ld = [] }: { page: PageKey; children: React.ReactNode; ld?: unknown[] }) {
  const site = await getSite();
  const p = PAGES[page];
  return (
    <>
      <Nav />
      <main id="top">
        <h1 className="sr-only"><L v={p.h1Bi} /></h1>
        <SiteProvider value={site}>{children}</SiteProvider>
        {page !== "reservasi" && (
          <form
            action="/reservasi"
            method="get"
            toolname="book_appointment"
            tooldescription="Buat reservasi janji temu dokter gigi di Estaka Dental Clinic Makassar."
            className="sr-only"
            aria-label="Reservasi cepat"
          >
            <label htmlFor={`quick-book-name-${page}`}>Nama lengkap</label>
            <input id={`quick-book-name-${page}`} name="nama" type="text" toolparamdescription="Nama lengkap pasien sesuai identitas." />
            <label htmlFor={`quick-book-phone-${page}`}>Nomor WhatsApp</label>
            <input id={`quick-book-phone-${page}`} name="wa" type="tel" toolparamdescription="Nomor WhatsApp aktif pasien (contoh: 08114440808)." />
            <label htmlFor={`quick-book-service-${page}`}>Layanan</label>
            <input id={`quick-book-service-${page}`} name="layanan" type="text" toolparamdescription="Jenis layanan gigi yang diinginkan (contoh: Scaling, Veneer, Implan, Ortodonti)." />
            <button type="submit">Lanjut ke reservasi</button>
          </form>
        )}
      </main>
      <Footer />
      <Global />
      <WhatsAppFab number={site.clinic.whatsapp} />
      {[dentistLd({ address: site.clinic.address, phone: site.clinic.phone }), breadcrumbLd(page), ...ld].map((o, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: LD_JSON(o) }} />
      ))}
    </>
  );
}
