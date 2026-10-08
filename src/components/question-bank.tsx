import { ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { excerpt } from "@/components/markdown";
import { areaBadge } from "@/components/question-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { filterOptions, listQuestions, PAGE_SIZE, type Filters } from "@/lib/questions/queries";

const selectCls = "h-11 w-full rounded-control border border-input bg-card px-3 text-base md:text-sm";

function href(base: string, f: Filters, page: number) {
  const p = new URLSearchParams();
  Object.entries({ ...f, page: page > 1 ? page : undefined }).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/** Banco de questões paginado, filtros por URL (funciona sem JS). `admin` mostra inativas e links de edição. */
export async function QuestionBank({ filters: f, basePath, detailPath, admin = false }: { filters: Filters; basePath: string; detailPath: string; admin?: boolean }) {
  const [{ items, total }, opts] = await Promise.all([listQuestions(f), filterOptions()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Object.entries(f).some(([k, v]) => k !== "page" && v !== undefined);

  return (
    <div className="flex flex-col gap-5">
      <form method="get" action={basePath} className="grid grid-cols-2 gap-3 rounded-card border border-border bg-card p-4 md:grid-cols-4">
        <div className="relative col-span-2 md:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={f.q} placeholder="Buscar por palavra no enunciado, assunto…" aria-label="Buscar questões" className="pl-9" />
        </div>
        <Select name="board" label="Vestibular" value={f.board} options={[["ENEM", "ENEM"], ["UFPR", "UFPR"]]} />
        <Select name="area" label="Área" value={f.area} options={[["linguagens", "Linguagens"], ["humanas", "Humanas"], ["natureza", "Natureza"], ["matematica", "Matemática"]]} />
        <Select name="year" label="Ano" value={f.year?.toString()} options={opts.years.map((y) => [String(y), String(y)])} />
        <Select name="kind" label="Tipo" value={f.kind} options={[["objective", "Objetiva"], ["discursive", "Discursiva"]]} />
        {opts.works.length > 0 && <Select name="work" label="Obra" value={f.work} options={opts.works.map((w) => [w.id, w.title])} />}
        {admin && <Select name="status" label="Situação" value={f.status} options={[["active", "Ativas"], ["inactive", "Desativadas"]]} />}
        <div className="col-span-2 flex items-end gap-2">
          <Button type="submit" className="flex-1">Filtrar</Button>
          {hasFilters && <Button asChild variant="outline"><Link href={basePath}>Limpar</Link></Button>}
        </div>
      </form>

      <p className="text-sm text-muted-foreground" role="status">
        {total === 0 ? "Nenhuma questão" : `${total.toLocaleString("pt-BR")} questões · página ${Math.min(f.page, pages)} de ${pages}`}
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={hasFilters ? "Nada encontrado" : "Banco vazio"}
          description={hasFilters ? "Tente remover algum filtro ou buscar por outra palavra." : admin ? "Importe provas em Importar ou rode o seed do ENEM." : "Ainda não há questões cadastradas."}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((q) => (
            <li key={q.id}>
              <Card className="transition-colors focus-within:border-primary hover:border-primary">
                <Link href={`${detailPath}/${q.id}`} className="flex flex-col gap-2 rounded-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {q.board && <Badge tone="neutral">{q.board.code}</Badge>}
                    {q.year && <Badge tone="neutral">{q.year}</Badge>}
                    {areaBadge(q.area)}
                    {q.number != null && <span className="text-xs font-semibold text-muted-foreground">Q{q.number}</span>}
                    {q.language && <Badge tone="primary">{q.language === "ingles" ? "Inglês" : "Espanhol"}</Badge>}
                    {q.kind === "discursive" && <Badge tone="warning">Discursiva</Badge>}
                    {q.work && <Badge tone="primary">{q.work.title}</Badge>}
                    {!q.is_active && <Badge tone="danger">Desativada</Badge>}
                  </div>
                  <p className="text-sm leading-relaxed">{excerpt(q.statement_md) || "(enunciado em imagem)"}</p>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" aria-disabled={f.page <= 1} className={f.page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={href(basePath, f, f.page - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden /> Anterior</Link>
          </Button>
          <span className="text-sm text-muted-foreground">{f.page} / {pages}</span>
          <Button asChild variant="outline" aria-disabled={f.page >= pages} className={f.page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={href(basePath, f, f.page + 1)} aria-label="Próxima página">Próxima <ChevronRight aria-hidden /></Link>
          </Button>
        </nav>
      )}
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: string[][] }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select name={name} defaultValue={value ?? ""} className={selectCls}>
        <option value="">Todos</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
