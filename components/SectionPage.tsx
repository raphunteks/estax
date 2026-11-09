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
