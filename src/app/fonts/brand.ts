import localFont from "next/font/local";

/** Fredoka (OFL): fonte da marca — títulos das páginas públicas, números e botões de destaque. */
export const brandFont = localFont({
  src: [
    { path: "./fredoka-600.ttf", weight: "600", style: "normal" },
    { path: "./fredoka-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-fredoka",
  display: "swap",
});
