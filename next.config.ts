import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Importações enviam pedaços de ~100 questões por server action (a Vercel limita o corpo a ~4,5 MB).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // App 100% autenticado e dinâmico: Cache Components não traz ganho aqui e
  // exigiria Suspense em toda leitura de sessão. Revisitar se houver páginas públicas.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
