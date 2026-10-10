"use client";

import { PlayCircle } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { GuideVideo } from "@/components/guide-video";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GUIDE_CHAPTERS } from "@/lib/guide";
import { setGuideDismissedAction } from "./actions";

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function GuidePlayer({ showOnLogin }: { showOnLogin: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [show, setShow] = useState(showOnLogin);
  const [pending, start] = useTransition();
  const jump = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => {});
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <div className="flex flex-col gap-6">
      <GuideVideo ref={video} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-sm font-medium">
        <input
          type="checkbox" className="size-5 accent-[var(--primary)]" checked={show} disabled={pending}
          onChange={(e) => {
            const v = e.target.checked;
            setShow(v);
            start(async () => {
              const r = await setGuideDismissedAction(!v);
              if (!r.ok) { setShow(!v); toast.error(r.error); }
            });
          }}
        />
        Mostrar este vídeo quando eu entrar
      </label>

      <section aria-labelledby="capitulos" className="flex flex-col gap-3">
        <h2 id="capitulos" className="text-lg font-bold">Capítulos</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {GUIDE_CHAPTERS.map((c) => (
            <li key={c.t}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <Button variant="soft" size="sm" onClick={() => jump(c.t)} aria-label={`Ver no vídeo: ${c.title} (${mmss(c.t)})`}>
                    <PlayCircle aria-hidden /> {mmss(c.t)}
                  </Button>
                  <h3 className="font-bold">{c.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{c.text}</p>
                {c.href && (
                  <Link href={c.href} className="mt-auto inline-flex min-h-10 items-center self-start text-sm font-semibold text-primary underline underline-offset-2">{c.cta} →</Link>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
