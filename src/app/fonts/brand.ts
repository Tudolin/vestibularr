import localFont from "next/font/local";

/** Fredoka (OFL): fonte da marca — títulos das páginas públicas, números e botões de destaque. */
export const brandFont = localFont({
  src: [
    { path: "./fredoka-600.woff2", weight: "600", style: "normal" },
    { path: "./fredoka-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-fredoka",
  display: "swap",
});
