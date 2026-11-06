import type { Metadata } from "next";
import ForgotForm from "@/components/auth/ForgotForm";

export const metadata: Metadata = {
  title: "Lupa kata sandi",
  description: "Atur ulang kata sandi akun Estaka Dental Clinic lewat tautan yang dikirim ke email Anda.",
  alternates: { canonical: "/lupa-sandi" },
};
export default function Page() {
  return <ForgotForm />;
}
