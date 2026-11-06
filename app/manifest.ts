import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Estaka Dental Clinic",
    short_name: "Estaka",
    description: "Janji, riwayat perawatan, dan notifikasi Estaka Dental Clinic.",
    lang: "id",
    start_url: "/masuk?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f1e5",
    theme_color: "#f6f1e5",
    categories: ["health", "medical"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Janji saya", url: "/portal/janji", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
