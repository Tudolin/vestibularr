import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function block(selector: string) {
  const m = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`bloco ${selector} não encontrado`);
  const vars: Record<string, string> = {};
  for (const [, k, v] of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[k] = v;
  return vars;
}

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [texto, fundo, mínimo]: 4.5 para texto, 3 para componentes/ícones.
const pairs: [string, string, number][] = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["muted-foreground", "card", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary-soft-foreground", "primary-soft", 4.5],
  ["primary", "background", 3],
  ["primary", "card", 3],
  ["success", "card", 4.5],
  ["success-soft-foreground", "success-soft", 4.5],
  ["danger", "card", 4.5],
  ["danger-soft-foreground", "danger-soft", 4.5],
  ["warning-soft-foreground", "warning-soft", 4.5],
  ...["linguagens", "humanas", "natureza", "matematica"].flatMap((a): [string, string, number][] => [
    [`area-${a}-foreground`, `area-${a}-soft`, 4.5],
    [`area-${a}`, "card", 3],
  ]),
  ["input", "card", 3],
];

describe.each([":root", ".dark"])("contraste AA em %s", (sel) => {
  const v = block(sel);
  it.each(pairs)("%s sobre %s ≥ %s", (fg, bg, min) => {
    expect(v[fg], `token ${fg}`).toBeDefined();
    expect(v[bg], `token ${bg}`).toBeDefined();
    expect(ratio(v[fg], v[bg])).toBeGreaterThanOrEqual(min);
  });
});
