import "server-only";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

/**
 * Markdown → HTML no SERVIDOR, sanitizado (rehype-sanitize; HTML cru do markdown é descartado).
 * Usado na tela da prova para não enviar o parser ao celular. Imagens só http(s), com lazy-load;
 * links abrem em nova aba sem acesso ao opener.
 */
const schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, src: ["http", "https"], href: ["http", "https", "mailto"] },
  attributes: { ...defaultSchema.attributes, img: ["src", "alt", "loading", "className"], a: ["href", "target", "rel", "className"] },
};

function decorate() {
  return (tree: Root) => {
    visit(tree, "element", (el: Element) => {
      if (el.tagName === "img") {
        el.properties = { ...el.properties, loading: "lazy", className: ["mx-auto", "max-h-[28rem]", "max-w-full", "rounded-control", "bg-white"] };
      } else if (el.tagName === "a") {
        el.properties = { ...el.properties, target: "_blank", rel: ["noopener", "noreferrer"], className: ["font-medium", "text-primary", "underline", "underline-offset-2"] };
      }
    });
  };
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize, schema).use(decorate).use(rehypeStringify);

export function markdownToHtml(md: string): string {
  return String(processor.processSync(md ?? ""));
}
