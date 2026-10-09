import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Vitrine e páginas legais indexáveis; o app (área logada) não. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/$", "/cadastro", "/termos", "/privacidade", "/landing/", "/brand/", "/guia/"], disallow: "/" }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
