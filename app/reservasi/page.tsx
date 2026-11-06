import SectionPage from "@/components/SectionPage";
import Booking from "@/components/Booking";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("reservasi");
export const revalidate = 60;
export default function Page() {
  return (
    <SectionPage page="reservasi">
      <Booking />
    </SectionPage>
  );
}
