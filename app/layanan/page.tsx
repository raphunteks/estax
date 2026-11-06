import SectionPage from "@/components/SectionPage";
import Services from "@/components/Services";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("layanan");
export const revalidate = 60;
export default function Page() {
  return (
    <SectionPage page="layanan">
      <Services />
    </SectionPage>
  );
}
