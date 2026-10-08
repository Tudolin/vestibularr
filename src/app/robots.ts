import type { MetadataRoute } from "next";

/** App privado (família): nada para indexar. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
