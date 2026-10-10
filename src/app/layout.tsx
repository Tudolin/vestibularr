import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { brandFont } from "./fonts/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: { type: "website", locale: "pt_BR", siteName: "Vestibularr" },
  twitter: { card: "summary_large_image" },
  title: { default: "Vestibularr", template: "%s · Vestibularr" },
  description: "Estude para o ENEM e a UFPR com resolução comentada de cada questão, simulados no tempo oficial e IA que corrige sua redação.",
  applicationName: "Vestibularr",
  appleWebApp: { capable: true, title: "Vestibularr", statusBarStyle: "default" },
  icons: { icon: "/icons/favicon-32.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff7ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0c22" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${brandFont.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Ir para o conteúdo
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
