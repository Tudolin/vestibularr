import { cn } from "@/lib/utils";

export type TreasureWeek = {
  week: string; goal: number; done: number; opened: boolean;
  days: { day: string; done: boolean; today: boolean; past: boolean }[];
};

const DAY = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
// porto de saída, 7 ilhas em zigue-zague e a ilha do tesouro
const PORT = [26, 128] as const;
const PTS = [[70, 112], [116, 70], [162, 112], [208, 70], [254, 112], [300, 70], [342, 112]] as const;
const CHEST = [378, 62] as const;
// cores fixas (legíveis no claro e no escuro, sobre o mar)
const INK = "#14123a", SAND = "#f6d68a", SAND_D = "#dcae55", GRASS = "#35b273", ROCK = "#8a86a6", GOLD = "#ffc83d", CORAL = "#ff6b5e";

function curve(a: readonly [number, number], b: readonly [number, number]) {
  const mx = (a[0] + b[0]) / 2;
  return `C ${mx} ${a[1]}, ${mx} ${b[1]}, ${b[0]} ${b[1]}`;
}
const STOPS = [PORT, ...PTS, CHEST];
function route(from: number, to: number) {
  let d = `M ${STOPS[from][0]} ${STOPS[from][1]}`;
  for (let i = from + 1; i <= to; i++) d += ` ${curve(STOPS[i - 1], STOPS[i])}`;
  return d;
}

function Palm({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M ${x} ${y} q 2 -10 -1 -19`} fill="none" stroke="#8a4b1f" strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M ${x - 1} ${y - 19} q -9 -3 -13 4 M ${x - 1} ${y - 19} q 9 -4 13 3 M ${x - 1} ${y - 19} q -3 -8 -11 -9 M ${x - 1} ${y - 19} q 4 -8 12 -7`}
        fill="none" stroke={GRASS} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Island({ x, y, state }: { x: number; y: number; state: "done" | "today" | "future" | "missed" }) {
  if (state === "missed") {
    return (
      <g opacity=".85">
        <ellipse cx={x} cy={y + 5} rx="13" ry="5" fill="#000" opacity=".12" />
        <path d={`M ${x - 11} ${y + 5} q 3 -11 11 -10 q 9 1 11 10 z`} fill={ROCK} />
        <path d={`M ${x - 4} ${y - 3} q 4 -4 8 0`} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
      </g>
    );
  }
  return (
    <g>
      {state === "today" && (
        <ellipse cx={x} cy={y + 5} rx="22" ry="11" fill="none" stroke="var(--primary)" strokeWidth="2.5" className="motion-safe:animate-[vr-pulse-ring_1.8s_ease-out_infinite]" style={{ transformOrigin: `${x}px ${y + 5}px` }} />
      )}
      <ellipse cx={x} cy={y + 6} rx="19" ry="7" fill="#fff" opacity=".35" />
      <ellipse cx={x} cy={y + 4} rx="17" ry="7" fill={SAND_D} />
      <ellipse cx={x} cy={y + 2} rx="15" ry="6" fill={SAND} />
      <ellipse cx={x - 3} cy={y + 1} rx="8" ry="3.5" fill={GRASS} opacity=".9" />
      <Palm x={x + 5} y={y + 2} />
      {state === "done" && (
        <g>
          <line x1={x - 6} y1={y + 2} x2={x - 6} y2={y - 20} stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M ${x - 5} ${y - 20} l 12 4 l -12 4 z`} fill={CORAL} />
        </g>
      )}
    </g>
  );
}

/** Mapa do tesouro da semana: cada desafio do dia concluído leva o navio a uma ilha; com 5, o baú abre. */
export function TreasureMap({ w }: { w: TreasureWeek }) {
  const lastDone = w.days.reduce((acc, d, i) => (d.done ? i : acc), -1);
  const prevDone = w.days.slice(0, Math.max(lastDone, 0)).reduce((acc, d, i) => (d.done ? i : acc), -1);
  // o navio ancora na água, à esquerda e um pouco abaixo da ilha (ou à direita do porto)
  const dock = (p: readonly [number, number], port = false) => [p[0] + (port ? 18 : -21), p[1] + (port ? -2 : 9)] as const;
  const here = lastDone >= 0 ? dock(PTS[lastDone]) : dock(PORT, true);
  const from = lastDone >= 0 ? (prevDone >= 0 ? dock(PTS[prevDone]) : dock(PORT, true)) : here;
  const left = Math.max(0, w.goal - w.done);
  const sail = { "--fx": `${from[0]}px`, "--fy": `${from[1]}px`, "--tx": `${here[0]}px`, "--ty": `${here[1]}px` } as React.CSSProperties;

  return (
    <section aria-labelledby="mapa-t" className="overflow-hidden rounded-card border-2 border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pb-3 pt-4">
        <h2 id="mapa-t" className="text-lg font-extrabold">Mapa do tesouro da semana</h2>
        <p className="font-display text-sm font-semibold text-muted-foreground">{Math.min(w.done, w.goal)}/{w.goal} ilhas</p>
      </div>
      <div className="mapa-mar motion-safe:animate-[vr-waves-bg_9s_linear_infinite]">
        <svg viewBox="0 0 400 165" role="img" aria-label={`Mapa do tesouro: ${w.done} de ${w.goal} desafios da semana concluídos${w.opened ? ", baú aberto" : ""}.`}
          className="mx-auto block h-auto w-full max-w-[640px] font-display">
          {/* rosa dos ventos */}
          <g transform="translate(26 30)" opacity=".55">
            <circle r="13" fill="none" stroke="#fff" strokeWidth="1.2" />
            <path d="M0 -15 L3 0 L0 15 L-3 0 Z" fill="#fff" />
            <path d="M-15 0 L0 -3 L15 0 L0 3 Z" fill="#fff" opacity=".7" />
            <text y="-18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">N</text>
          </g>
          {/* rota: pontilhada inteira; o trecho já navegado em dourado */}
          <path d={route(0, STOPS.length - 1)} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2.2" strokeDasharray="1.5 6" strokeLinecap="round" />
          {lastDone >= 0 && <path d={route(0, lastDone + 1)} fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="1.5 6" strokeLinecap="round" />}
          {/* porto */}
          <g>
            <rect x={PORT[0] - 13} y={PORT[1] + 2} width="26" height="5" rx="1.5" fill="#8a4b1f" />
            {[-9, 0, 9].map((dx) => <rect key={dx} x={PORT[0] + dx - 1} y={PORT[1] + 5} width="2.5" height="7" fill="#6b3712" />)}
            <text x={PORT[0]} y={PORT[1] + 24} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={INK} className="dark:fill-white" opacity=".75">Porto</text>
          </g>
          {PTS.map(([x, y], i) => {
            const d = w.days[i];
            const state = d?.done ? "done" : d?.today ? "today" : d?.past ? "missed" : "future";
            return (
              <g key={i}>
                <Island x={x} y={y} state={state} />
                <text x={x} y={y + 24} textAnchor="middle" fontSize={d?.today ? 11 : 10} fontWeight="700"
                  fill={d?.today ? "var(--primary)" : INK} className={d?.today ? "" : "dark:fill-white"} opacity={state === "missed" ? 0.6 : 0.9}>
                  {d?.today ? "Hoje" : DAY[i]}
                </text>
              </g>
            );
          })}
          {/* ilha do tesouro: X na areia e o baú */}
          <g>
            <ellipse cx={CHEST[0]} cy={CHEST[1] + 22} rx="20" ry="8" fill={SAND_D} />
            <ellipse cx={CHEST[0]} cy={CHEST[1] + 20} rx="18" ry="7" fill={SAND} />
            <path d={`M ${CHEST[0] - 7} ${CHEST[1] + 16} l 14 8 M ${CHEST[0] + 7} ${CHEST[1] + 16} l -14 8`} stroke={CORAL} strokeWidth="3.2" strokeLinecap="round" />
            {w.opened && <circle cx={CHEST[0]} cy={CHEST[1] + 2} r="22" fill={GOLD} opacity=".35" className="motion-safe:animate-[vr-pulse-ring_2.4s_ease-out_infinite]" style={{ transformOrigin: `${CHEST[0]}px ${CHEST[1] + 2}px` }} />}
            <g transform={`translate(${CHEST[0] - 14} ${CHEST[1] - 12})`}>
              <rect x="0" y="12" width="28" height="17" rx="2.5" fill="#8a4b1f" stroke={INK} strokeWidth="1.2" />
              <rect x="0" y="12" width="28" height="3.5" fill="#6b3712" />
              <g transform={w.opened ? "rotate(-30 1 12)" : undefined}>
                <path d="M0 12 q14 -14 28 0 z" fill="#a85d29" stroke={INK} strokeWidth="1.2" />
              </g>
              <rect x="11.5" y="14" width="5" height="6" rx="1.2" fill={GOLD} />
              {w.opened && <g fill={GOLD} stroke="#c7951c" strokeWidth=".8"><circle cx="8" cy="10" r="3" /><circle cx="14" cy="7" r="3.4" /><circle cx="20.5" cy="10" r="3" /></g>}
            </g>
          </g>
          {/* o navio: navega da última ilha até a atual e balança na água */}
          <g className="motion-safe:animate-[vr-sail_1.4s_ease-in-out_both]" style={{ ...sail, transform: `translate(${here[0]}px, ${here[1]}px)` }}>
            <g className="motion-safe:animate-[vr-bob_2.6s_ease-in-out_infinite]">
              <g transform="translate(-16 -36)">
                <path d="M0 24 h32 l-6 10 h-20 z" fill="#8a4b1f" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M3 27 h26" stroke="#6b3712" strokeWidth="1.2" />
                <line x1="16" y1="25" x2="16" y2="3" stroke={INK} strokeWidth="1.8" />
                <path d="M17 6 q11 8 0 17 z" fill="#fff7ea" stroke={INK} strokeWidth="1" />
                <path d="M15 8 q-11 7 0 15 z" fill="#fff7ea" stroke={INK} strokeWidth="1" />
                {/* bandeira pirata */}
                <path d="M16 0 h11 l-2 3 l2 3 h-11 z" fill={INK} />
                <circle cx="20.5" cy="2.6" r="1.5" fill="#fff" />
                <path d="M18.6 4.6 l3.8 1 M22.4 4.6 l-3.8 1" stroke="#fff" strokeWidth=".7" />
              </g>
            </g>
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-4 pt-3">
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: w.goal }, (_, i) => (
            <span key={i} className={cn("size-4 rounded-full border-2", i < w.done ? "border-[#c7951c] bg-[#ffc83d]" : "border-border bg-muted")} />
          ))}
        </span>
        <p className={cn("min-w-[12rem] flex-1 text-sm", w.opened ? "font-bold text-success" : "text-muted-foreground")}>
          {w.opened ? "Arr! Baú aberto: +100 XP e 1 escudo de sequência. Segunda tem mapa novo."
            : left === 0 ? "Arr! Baú garantido: o tesouro está a caminho."
            : left === w.goal ? "Cada desafio do dia leva o navio a uma ilha. Com 5 na semana, o baú é seu: +100 XP e 1 escudo."
            : `${left === 1 ? "Falta 1 desafio" : `Faltam ${left} desafios`} para abrir o baú (+100 XP e 1 escudo). Arr!`}
        </p>
      </div>
    </section>
  );
}
