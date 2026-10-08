"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { Facets } from "@/lib/attempts/queries";
import { UFPR_2027_SUBJECTS } from "@/lib/scoring/ufpr";
import { cn } from "@/lib/utils";
import { startAttemptAction } from "../actions";

const AREA_LABEL: Record<string, string> = { linguagens: "Linguagens", humanas: "Humanas", natureza: "Natureza", matematica: "Matemática" };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick}
      className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold", on ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-input bg-card text-foreground hover:bg-muted")}>
      {on && "✓ "}{children}
    </button>
  );
}

export function CustomForm({ facets, initialMode }: { facets: Facets; initialMode: "custom" | "treino" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"custom" | "treino">(initialMode);
  const [board, setBoard] = useState<"" | "ENEM" | "UFPR">("");
  const [areas, setAreas] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState<number | "">(60);
  const [language, setLanguage] = useState<"ingles" | "espanhol">("ingles");

  const toggle = (set: (f: (v: string[]) => string[]) => void, v: string) => set((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  const inBoard = <T extends { board: string }>(l: T[]) => l.filter((x) => !board || x.board === board);
  const subjectOpts = useMemo(() => [...new Map(inBoard(facets.subjects).map((s) => [s.name, s])).values()], [facets, board]); // eslint-disable-line react-hooks/exhaustive-deps
  const areaOpts = useMemo(() => [...new Set(inBoard(facets.areas).map((a) => a.name))], [facets, board]); // eslint-disable-line react-hooks/exhaustive-deps
  const topicOpts = useMemo(() => inBoard(facets.topics).filter((t) => !subjects.length || (t.subject && subjects.includes(t.subject))), [facets, board, subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(extra: Record<string, unknown> = {}) {
    start(async () => {
      const r = await startAttemptAction({
        mode, board: board || undefined, areas: areas.length ? areas : undefined, subjects: subjects.length ? subjects : undefined,
        topics: topics.length ? topics : undefined, count, minutes: mode === "custom" && minutes ? Number(minutes) : undefined, language, ...extra,
      });
      if (r.ok) router.push(`/prova/${r.id}`);
      else toast.error(r.error);
    });
  }

  /** Modelo do edital UFPR 2027: 80 objetivas por disciplina + 2 discursivas, 5h30. Usa as disciplinas que existem no banco. */
  function ufprPreset() {
    const have = new Map(facets.subjects.filter((s) => s.board === "UFPR").map((s) => [norm(s.name), s.name]));
    const quotas: Record<string, number> = {};
    const missing: string[] = [];
    for (const [name, n] of Object.entries(UFPR_2027_SUBJECTS)) {
      const key = have.get(norm(name)) ?? [...have.entries()].find(([k]) => k.startsWith(norm(name).split(" ")[0]))?.[1];
      if (key) quotas[key] = n;
      else missing.push(name);
    }
    if (!Object.keys(quotas).length) return toast.error("Ainda não há questões UFPR com disciplina no banco. Importe provas da UFPR primeiro.");
    if (missing.length) toast.message(`Sem questões de: ${missing.join(", ")}. O modelo será montado com o que existe.`);
    start(async () => {
      const r = await startAttemptAction({ mode: "custom", board: "UFPR", quotas, discursive: 2, minutes: 330, title: "Modelo UFPR 2027 (80 objetivas + CPT)", preset: "ufpr2027" });
      if (r.ok) router.push(`/prova/${r.id}`);
      else toast.error(r.error);
    });
  }

  const hasUfpr = facets.subjects.some((s) => s.board === "UFPR");

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2 rounded-full border border-border bg-muted p-1">
        {([["custom", "Simulado"], ["treino", "Treino"]] as const).map(([v, l]) => (
          <button key={v} role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
            className={cn("min-h-11 rounded-full text-sm font-bold", mode === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>

      {hasUfpr && mode === "custom" && (
        <Card className="flex flex-col gap-2 p-4">
          <p className="font-bold">Modelo UFPR 2027</p>
          <p className="text-sm text-muted-foreground">80 objetivas na distribuição do edital + 2 discursivas (CPT), em 5h30 com cronômetro único.</p>
          <Button variant="soft" className="self-start" disabled={pending} onClick={ufprPreset}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} Montar e começar</Button>
        </Card>
      )}

      <Card className="grid gap-5 p-5">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">Vestibular</legend>
          <div className="flex flex-wrap gap-2">
            {(["", "ENEM", "UFPR"] as const).map((b) => (
              <Chip key={b || "all"} on={board === b} onClick={() => { setBoard(b); setAreas([]); setSubjects([]); setTopics([]); }}>{b || "Todos"}</Chip>
            ))}
          </div>
        </fieldset>

        {areaOpts.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-bold">Áreas</legend>
            <div className="flex flex-wrap gap-2">{areaOpts.map((a) => <Chip key={a} on={areas.includes(a)} onClick={() => toggle(setAreas, a)}>{AREA_LABEL[a] ?? a}</Chip>)}</div>
          </fieldset>
        )}
        {subjectOpts.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-bold">Disciplinas</legend>
            <div className="flex flex-wrap gap-2">{subjectOpts.map((s) => <Chip key={s.name} on={subjects.includes(s.name)} onClick={() => toggle(setSubjects, s.name)}>{s.name}</Chip>)}</div>
          </fieldset>
        )}
        {topicOpts.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-bold">Assuntos</legend>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">{topicOpts.slice(0, 80).map((t) => <Chip key={`${t.subject}-${t.name}`} on={topics.includes(t.name)} onClick={() => toggle(setTopics, t.name)}>{t.name}</Chip>)}</div>
          </fieldset>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="count">Quantidade de questões</Label>
            <Input id="count" type="number" min={1} max={180} value={count} onChange={(e) => setCount(Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
          </div>
          {mode === "custom" && (
            <div className="grid gap-1.5">
              <Label htmlFor="minutes">Tempo (minutos, vazio = sem limite)</Label>
              <Input id="minutes" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value === "" ? "" : Math.max(1, Math.min(600, Number(e.target.value))))} />
            </div>
          )}
        </div>

        {board !== "UFPR" && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-bold">Língua estrangeira (ENEM)</legend>
            <div className="flex gap-2">
              <Chip on={language === "ingles"} onClick={() => setLanguage("ingles")}>Inglês</Chip>
              <Chip on={language === "espanhol"} onClick={() => setLanguage("espanhol")}>Espanhol</Chip>
            </div>
          </fieldset>
        )}

        <Button size="lg" disabled={pending} onClick={() => submit()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} Começar {mode === "treino" ? "treino" : "simulado"}
        </Button>
      </Card>
    </div>
  );
}
