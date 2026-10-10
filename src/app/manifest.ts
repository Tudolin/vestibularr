import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vestibularr — ENEM e UFPR",
    short_name: "Vestibularr",
    description: "Simulados, treino e redação para ENEM e Vestibular UFPR.",
    lang: "pt-BR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff7ea",
    theme_color: "#2f3cff",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Estudar", url: "/estudar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Redação", url: "/redacao", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
