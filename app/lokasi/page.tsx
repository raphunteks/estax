import SectionPage from "@/components/SectionPage";
import { Location } from "@/components/Sections";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("lokasi");
export const revalidate = 60;
export default function Page() {
  return (
    <SectionPage page="lokasi">
      <Location />
    </SectionPage>
  );
}
