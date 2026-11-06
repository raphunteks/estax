import SectionPage from "@/components/SectionPage";
import { Pricing } from "@/components/Sections";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("biaya");
export const revalidate = 60;
export default function Page() {
  return (
    <SectionPage page="biaya">
      <Pricing />
    </SectionPage>
  );
}
