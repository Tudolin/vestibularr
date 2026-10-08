import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
