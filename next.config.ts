import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Importações enviam pedaços de ~100 questões por server action (a Vercel limita o corpo a ~4,5 MB).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // App 100% autenticado e dinâmico: Cache Components não traz ganho aqui e
  // exigiria Suspense em toda leitura de sessão. Revisitar se houver páginas públicas.
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
