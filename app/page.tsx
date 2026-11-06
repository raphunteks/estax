import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import { Marquee } from "@/components/Intro";
import Footer from "@/components/Footer";
import Below from "@/components/Below";
import { WhatsAppFab } from "@/components/Sections";
import { getSite } from "@/lib/site";
import { LD_JSON, dentistLd } from "@/lib/seo";

export const revalidate = 60; // editable content from the dashboard shows up within a minute

export default async function Home() {
  const site = await getSite();
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Below site={site} />
      </main>
      <Footer />
      <WhatsAppFab number={site.clinic.whatsapp} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: LD_JSON(dentistLd({ address: site.clinic.address, phone: site.clinic.phone })) }} />
    </>
  );
}
