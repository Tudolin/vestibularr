import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/markdown-html";

describe("markdown → HTML sanitizado (tela da prova)", () => {
  it("renderiza markdown e tabelas GFM", () => {
    const h = markdownToHtml("**negrito**\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(h).toContain("<strong>negrito</strong>");
    expect(h).toContain("<table>");
  });
  it("descarta HTML cru, scripts e handlers", () => {
    const h = markdownToHtml('oi <script>alert(1)</script> <img src="x" onerror="alert(1)"> <b onclick="x()">b</b>');
    expect(h).not.toMatch(/<script|onerror|onclick/i);
  });
  it("bloqueia javascript: em links e imagens; imagens https ganham lazy-load", () => {
    const h = markdownToHtml("[clique](javascript:alert(1)) ![x](javascript:alert(2)) ![fig](https://ex.com/a.png)");
    expect(h).not.toContain("javascript:");
    expect(h).toMatch(/<img[^>]*src="https:\/\/ex\.com\/a\.png"[^>]*loading="lazy"/);
  });
  it("links externos abrem em nova aba sem opener", () => {
    expect(markdownToHtml("[site](https://ex.com)")).toMatch(/target="_blank"[^>]*rel="noopener noreferrer"/);
  });
});
