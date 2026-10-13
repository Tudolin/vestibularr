import { MessageSquareHeart } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { FEEDBACK_KINDS, FEEDBACK_PAGES, FEEDBACK_STATUS, RATING_FACES, feedbackPage, type FeedbackKind } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Feedback" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

type Row = { id: string; kind: FeedbackKind; rating: number | null; message: string; page: string | null; status: string; reply: string | null; replied_at: string | null; created_at: string };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ de?: string; tipo?: string }> }) {
  const me = await requireUser();
  const { de, tipo } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("feedback").select("id, kind, rating, message, page, status, reply, replied_at, created_at")
    .eq("user_id", me.id).order("created_at", { ascending: false }).limit(50);
  const mine = (data ?? []) as Row[];
  const initialKind = FEEDBACK_KINDS.find((k) => k.key === tipo)?.key;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl"><MessageSquareHeart className="size-7 text-primary" aria-hidden /> Feedback</h1>
        <p className="text-muted-foreground">
          O Vestibularr está em beta e é feito junto com quem estuda. Elogio, ideia, algo confuso ou um problema: tudo chega direto na equipe, e a gente responde por aqui.
        </p>
      </header>

      <FeedbackForm initialPage={feedbackPage(de)} initialKind={initialKind} />

      {mine.length > 0 && (
        <section aria-labelledby="meus" className="flex flex-col gap-3">
          <h2 id="meus" className="text-lg font-bold">Seus feedbacks</h2>
          <ul className="flex flex-col gap-3">
            {mine.map((f) => {
              const k = FEEDBACK_KINDS.find((x) => x.key === f.kind);
              const st = FEEDBACK_STATUS[f.status] ?? FEEDBACK_STATUS.novo;
              return (
                <li key={f.id}>
                  <Card className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold">{k?.emoji} {k?.label}</span>
                      {f.rating && <span aria-label={`Nota ${f.rating} de 5`}>{RATING_FACES[f.rating - 1]}</span>}
                      <span className="text-muted-foreground">· {fmt(f.created_at)}{f.page ? ` · ${FEEDBACK_PAGES.find(([p]) => p === f.page)?.[1] ?? f.page}` : ""}</span>
                      <Badge tone={st.tone} className="ml-auto">{st.label}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{f.message}</p>
                    {f.reply && (
                      <div className="rounded-control bg-primary-soft p-3 text-sm text-primary-soft-foreground">
                        <p className="font-bold">Resposta da equipe{f.replied_at ? ` · ${fmt(f.replied_at)}` : ""}</p>
                        <p className="whitespace-pre-wrap">{f.reply}</p>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
