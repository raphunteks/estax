import SectionPage from "@/components/SectionPage";
import DoctorSlider from "@/components/DoctorSlider";
import { Team } from "@/components/Social";
import { doctorsLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("dokter");
export const revalidate = 60;
export default function Page() {
  return (
    <SectionPage page="dokter" ld={[doctorsLd()]}>
      <DoctorSlider />
      <Team />
    </SectionPage>
  );
}
