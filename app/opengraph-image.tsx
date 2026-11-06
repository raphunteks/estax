import { ImageResponse } from "next/og";

export const alt = "Estaka Dental Clinic, dokter gigi umum dan spesialis di Makassar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0a0d18 0%,#1b2a6b 100%)", color: "#fff" }}>
        <div style={{ fontSize: 34, letterSpacing: 6, textTransform: "uppercase", opacity: 0.75 }}>Makassar</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 112, fontWeight: 600, lineHeight: 1.02 }}>Estaka Dental Clinic</div>
          <div style={{ fontSize: 40, marginTop: 24, opacity: 0.85 }}>Dokter gigi umum dan spesialis konservasi</div>
        </div>
        <div style={{ fontSize: 30, opacity: 0.7 }}>Reservasi janji online</div>
      </div>
    ),
    size,
  );
}
