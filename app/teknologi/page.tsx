import SectionPage from "@/components/SectionPage";
import Technology from "@/components/Technology";
import Journey from "@/components/Journey";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("teknologi");
export const revalidate = 60;
export default function Page() {
  return (
    <SectionPage page="teknologi">
      <Technology />
      <Journey />
    </SectionPage>
  );
}
