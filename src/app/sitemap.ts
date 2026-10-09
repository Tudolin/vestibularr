import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/cadastro`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/termos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
