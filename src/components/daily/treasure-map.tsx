import { cn } from "@/lib/utils";

export type TreasureWeek = {
  week: string; goal: number; done: number; opened: boolean;
  days: { day: string; done: boolean; today: boolean; past: boolean }[];
};

const DAY = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
// ilhas em zigue-zague pelo mar; o "X" do tesouro no fim
const PTS = [[34, 104], [80, 64], [126, 100], [172, 60], [218, 98], [264, 58], [306, 96]] as const;
const X = [344, 52] as const;

function path() {
  const all = [...PTS, X];
  let d = `M ${all[0][0]} ${all[0][1]}`;
  for (let i = 1; i < all.length; i++) {
    const [x0, y0] = all[i - 1], [x1, y1] = all[i];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

/** Mapa do tesouro da semana: cada desafio do dia concluído leva o navio a uma ilha; com 5, o baú abre. */
export function TreasureMap({ w }: { w: TreasureWeek }) {
  const lastDone = w.days.reduce((acc, d, i) => (d.done ? i : acc), -1);
  const [sx, sy] = lastDone >= 0 ? PTS[lastDone] : [PTS[0][0] - 22, PTS[0][1] + 18];
  const left = Math.max(0, w.goal - w.done);
  return (
    <section aria-labelledby="mapa-t" className="overflow-hidden rounded-card border-2 border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-4">
        <h2 id="mapa-t" className="text-lg font-extrabold">Mapa do tesouro da semana</h2>
        <p className="text-sm font-semibold text-muted-foreground">{Math.min(w.done, 7)}/{w.goal} ilhas</p>
      </div>
      <svg viewBox="0 0 380 150" role="img" aria-label={`Mapa do tesouro: ${w.done} de ${w.goal} desafios da semana concluídos${w.opened ? ", baú aberto" : ""}.`}
        className="mt-1 block h-auto w-full">
        <defs>
          <pattern id="ondas" width="28" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 10 q7 -6 14 0 t14 0" fill="none" stroke="var(--primary)" strokeOpacity=".12" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="380" height="150" fill="var(--primary-soft)" opacity=".55" />
        <rect width="380" height="150" fill="url(#ondas)" />
        {/* rota pontilhada */}
        <path d={path()} fill="none" stroke="var(--foreground)" strokeOpacity=".35" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
        {PTS.map(([x, y], i) => {
          const d = w.days[i];
          const missed = d && d.past && !d.done;
          return (
            <g key={i}>
              <ellipse cx={x} cy={y + 4} rx="17" ry="8" fill={missed ? "var(--muted)" : "#ffc83d"} stroke={d?.today ? "var(--primary)" : "transparent"} strokeWidth="2.5" />
              <ellipse cx={x} cy={y + 1} rx="11" ry="5" fill={missed ? "var(--border)" : "#ffe08a"} />
              {d?.done && (
                <g>
                  <line x1={x + 4} y1={y + 2} x2={x + 4} y2={y - 18} stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" />
                  <path d={`M ${x + 5} ${y - 18} l 12 4 l -12 4 z`} fill="#ff6b5e" />
                </g>
              )}
              <text x={x} y={y + 26} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--muted-foreground)">{DAY[i]}</text>
            </g>
          );
        })}
        {/* o X do tesouro e o baú */}
        <g>
          <path d={`M ${X[0] - 9} ${X[1] + 32} l 18 18 M ${X[0] + 9} ${X[1] + 32} l -18 18`} stroke="#ff6b5e" strokeWidth="4" strokeLinecap="round" />
          <g transform={`translate(${X[0] - 16} ${X[1] - 10})`}>
            <rect x="0" y="14" width="32" height="20" rx="3" fill="#8a4b1f" />
            <rect x="0" y="14" width="32" height="4" fill="#6b3712" />
            <g transform={w.opened ? "rotate(-28 2 14)" : undefined}>
              <path d="M0 14 q16 -16 32 0 z" fill="#a85d29" />
            </g>
            <rect x="13" y="16" width="6" height="7" rx="1.5" fill="#ffc83d" />
            {w.opened && <g fill="#ffc83d"><circle cx="9" cy="12" r="3" /><circle cx="16" cy="9" r="3.5" /><circle cx="23" cy="12" r="3" /></g>}
          </g>
        </g>
        {/* o navio */}
        <g className="motion-safe:animate-[vr-bob_2.6s_ease-in-out_infinite]" style={{ transformOrigin: `${sx}px ${sy}px` }}>
          <g transform={`translate(${sx - 14} ${sy - 34})`}>
            <path d="M2 22 h24 l-4 8 h-16 z" fill="var(--foreground)" />
            <line x1="14" y1="22" x2="14" y2="2" stroke="var(--foreground)" strokeWidth="2" />
            <path d="M15 4 l10 9 h-10 z" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1" />
            <path d="M13 6 l-9 11 h9 z" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1" />
            <path d="M14 0 l7 2.5 l-7 2.5 z" fill="var(--foreground)" />
          </g>
        </g>
      </svg>
      <p className={cn("px-5 pb-4 pt-1 text-sm", w.opened ? "font-bold text-success" : "text-muted-foreground")}>
        {w.opened ? "Arr! Baú aberto: +100 XP e 1 escudo de sequência. Volte segunda para um novo mapa."
          : left === w.goal ? "Cada desafio do dia leva o navio a uma ilha. Com 5 na semana, o baú é seu: +100 XP e 1 escudo."
          : `${left === 1 ? "Falta 1 desafio" : `Faltam ${left} desafios`} para abrir o baú (+100 XP e 1 escudo). Arr!`}
      </p>
    </section>
  );
}
