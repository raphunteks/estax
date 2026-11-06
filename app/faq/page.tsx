import SectionPage from "@/components/SectionPage";
import Faq from "@/components/Faq";
import { pageMetadata, faqLd } from "@/lib/seo";

export const metadata = pageMetadata("faq");
export const revalidate = 60;
export default function Page() {
  return (
    <SectionPage page="faq" ld={[faqLd()]}>
      <Faq />
    </SectionPage>
  );
}
