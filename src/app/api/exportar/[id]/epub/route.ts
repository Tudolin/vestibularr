import { buildEpub } from "@/lib/export/epub";
import { loadExport } from "@/lib/export/load";
import { safeFilename } from "@/lib/export/types";

export const maxDuration = 60; // baixar e embutir as figuras pode levar alguns segundos

/** Baixa a lista como EPUB (Kindle, Apple Livros, Google Play Livros). Baixar de novo não gasta do plano. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await loadExport(id);
  if (!c) return new Response("Lista não encontrada.", { status: 404 });
  const data = await buildEpub(c, new URL(request.url).origin);
  return new Response(data as unknown as BodyInit, {
    headers: {
      "content-type": "application/epub+zip",
      "content-disposition": `attachment; filename="${safeFilename(c.title)}.epub"`,
      "cache-control": "private, no-store",
    },
  });
}
