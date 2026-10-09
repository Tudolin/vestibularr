import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isLocalImage } from "@/lib/local-image";
import { cn } from "@/lib/utils";

/**
 * Renderiza markdown de enunciados. react-markdown não interpreta HTML cru, e o
 * urlTransform padrão bloqueia `javascript:`; ainda assim só liberamos imagens http(s) ou do próprio app (/questoes/).
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-q space-y-3 [&_p]:whitespace-pre-line text-[1.0625rem] leading-relaxed [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) =>
            typeof src === "string" && (/^https?:\/\//i.test(src) || isLocalImage(src)) ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagens externas de provas; sem otimizador
              <img src={src} alt={alt ?? ""} loading="lazy" className="mx-auto max-h-[28rem] max-w-full rounded-control bg-white" />
            ) : null,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Texto simples curto para listas (remove imagens, links e marcações). */
export function excerpt(md: string, max = 220) {
  const t = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}
