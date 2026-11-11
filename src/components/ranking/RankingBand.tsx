import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

// Franja de apertura del ranking público: podio con arte de leader, tres cifras
// del circuito y una acción según quién llega. Plana (DESIGN.md: The Flat Content
// Rule): una sola superficie, separada por líneas, sin glows ni degradados.

export type BandRow = {
  player_id: string;
  geek_tag: string;
  points: number;
  rank_position: number;
  rank_delta: number | null;
};
export type BandLeader = { name: string; image: string | null };
type Audience = "visitor" | "player" | "staff";

// Mismos colores de podio que el dashboard: solo la cifra del rango, nunca la fila.
export const PODIUM_TEXT = ["text-yellow-400", "text-slate-200", "text-amber-600"] as const;

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** 37 -> "37", 37.5 -> "37.5" (sin ceros sobrantes). */
function fmtPts(n: number): string {
  return Number(n.toFixed(2)).toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

/** Cuenta de 0 a `target` una sola vez (ease-out exponencial); sin animar, devuelve el valor. */
function useCountUp(target: number, animate: boolean, delayMs: number): number {
  const [value, setValue] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now() + delayMs;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 600));
      setValue(p === 1 ? target : Math.round(target * (1 - Math.pow(2, -10 * p))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, delayMs]);
  return value;
}

function LeaderArt({ leader, tag }: { leader: BandLeader | undefined; tag: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex w-10 flex-shrink-0 justify-center @3xl:w-16 @5xl:w-20">
      {leader?.image && !broken ? (
        <img
          src={leader.image}
          alt={`Leader ${leader.name}`}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-14 w-10 rounded-md border border-border object-cover @3xl:h-[90px] @3xl:w-16 @5xl:h-28 @5xl:w-20"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-mono-stat text-xs font-bold text-foreground @3xl:h-14 @3xl:w-14 @5xl:h-16 @5xl:w-16 @5xl:text-sm"
        >
          {tag.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function PodiumCell({
  row,
  leader,
  index,
  intro,
}: {
  row: BandRow;
  leader: BandLeader | undefined;
  index: number;
  intro: boolean;
}) {
  const delay = index * 0.09;
  const points = useCountUp(row.points, intro, delay * 1000);
  return (
    <motion.li
      initial={intro ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT_EXPO }}
    >
      <Link
        to="/players/$playerTag"
        params={{ playerTag: row.geek_tag }}
        className="flex items-center gap-3 p-3 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary @3xl:p-4 @5xl:gap-4 @5xl:p-5"
      >
        <LeaderArt leader={leader} tag={row.geek_tag} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2 @3xl:block">
            <span
              className={`font-mono-stat text-3xl font-bold leading-none @3xl:text-4xl @5xl:text-5xl ${PODIUM_TEXT[index]}`}
            >
              <span className="sr-only">Lugar </span>
              {row.rank_position}
            </span>
            <p className="truncate font-semibold text-foreground @3xl:mt-2 @5xl:text-lg">
              {row.geek_tag}
            </p>
          </div>
          <p className="mt-0.5 font-mono-stat text-sm text-foreground-secondary">
            {fmtPts(points)} pts
          </p>
        </div>
      </Link>
    </motion.li>
  );
}

function PlayerStory({
  me,
  above,
  periodLabel,
  scopeLabel,
  showDelta,
}: {
  me: BandRow | undefined;
  above: BandRow | undefined;
  periodLabel: string;
  scopeLabel: string;
  showDelta: boolean;
}) {
  if (!me) {
    return (
      <div>
        <p className="text-sm text-foreground">Sin puntos en {periodLabel || "este periodo"}</p>
        <Link
          to="/calendar"
          className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-h-9"
        >
          Ver el calendario de torneos
        </Link>
      </div>
    );
  }
  const tier = me.rank_position <= 3 ? PODIUM_TEXT[me.rank_position - 1] : "text-foreground";
  const gap = above ? Number((above.points - me.points).toFixed(2)) : null;
  const delta = me.rank_delta;
  const n = delta === null ? 0 : Math.abs(delta);
  return (
    <div>
      <p className="text-sm text-foreground-secondary">Tu lugar · {scopeLabel}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`font-mono-stat text-4xl font-bold leading-none ${tier}`}>
          #{me.rank_position}
        </span>
        {showDelta &&
          (delta === null ? (
            <span className="text-sm text-foreground-subtle">Nuevo este mes</span>
          ) : delta === 0 ? (
            <span className="text-sm text-foreground-subtle">Mismo lugar que el mes pasado</span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-sm font-medium ${
                delta > 0 ? "text-success" : "text-danger"
              }`}
            >
              {delta > 0 ? (
                <ArrowUp size={14} aria-hidden="true" />
              ) : (
                <ArrowDown size={14} aria-hidden="true" />
              )}
              {delta > 0 ? "Subiste" : "Bajaste"} {n} {n === 1 ? "lugar" : "lugares"}
            </span>
          ))}
      </div>
      <p className="mt-1 text-sm text-foreground-secondary">
        {above === undefined
          ? "Vas en primer lugar"
          : gap! > 0
            ? `A ${fmtPts(gap!)} pts del #${above.rank_position}`
            : `Empatas en puntos con el #${above.rank_position}; desempata el OMW %`}
      </p>
      <Link
        to="/players/$playerTag"
        params={{ playerTag: me.geek_tag }}
        className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-h-9"
      >
        Ver mi perfil
      </Link>
    </div>
  );
}

function BandSkeleton() {
  return (
    <section
      aria-busy="true"
      className="@container mb-5 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="grid grid-cols-1 divide-y divide-border @3xl:grid-cols-3 @3xl:divide-x @3xl:divide-y-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 @3xl:p-4 @5xl:gap-4 @5xl:p-5">
            <div className="h-14 w-10 animate-pulse rounded-md bg-white/[0.06] @3xl:h-[90px] @3xl:w-16 @5xl:h-28 @5xl:w-20" />
            <div className="space-y-2">
              <div className="h-7 w-24 animate-pulse rounded bg-white/[0.06] @3xl:h-9" />
              <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-24 border-t border-border" />
    </section>
  );
}

export function RankingBand({
  rows,
  leaders,
  loading,
  periodLabel,
  scopeLabel,
  showDelta,
  stats,
  audience,
  audienceLoading,
  viewerTag,
}: {
  /** Tabla completa del periodo, sin el filtro de búsqueda. */
  rows: BandRow[];
  leaders: Record<string, BandLeader>;
  loading: boolean;
  periodLabel: string;
  scopeLabel: string;
  showDelta: boolean;
  stats: { players: number; stores: number; tournaments: number; tournamentsLabel: string };
  audience: Audience;
  audienceLoading: boolean;
  viewerTag: string | null;
}) {
  const reduced = useReducedMotion();
  const top = rows.slice(0, 3);

  // La entrada se juega una sola vez, cuando llegan los primeros datos. Las celdas se
  // keyean por posición, así que un cambio de filtros no las remonta ni repite el efecto.
  const introRef = useRef<boolean | null>(null);
  if (introRef.current === null && !loading && top.length > 0) introRef.current = !reduced;
  const intro = introRef.current === true;
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => {
      introRef.current = false;
    }, 1400);
    return () => clearTimeout(t);
  }, [intro]);

  if (loading) return <BandSkeleton />;
  if (top.length === 0) return null;

  const myIndex = viewerTag ? rows.findIndex((r) => r.geek_tag === viewerTag) : -1;
  const me = myIndex >= 0 ? rows[myIndex] : undefined;
  const above = myIndex > 0 ? rows[myIndex - 1] : undefined;

  return (
    <section
      aria-label="Los tres primeros del ranking"
      className="@container mb-5 overflow-hidden rounded-xl border border-border bg-card"
    >
      <ol className="grid grid-cols-1 divide-y divide-border @3xl:grid-cols-3 @3xl:divide-x @3xl:divide-y-0">
        {top.map((row, i) => (
          <PodiumCell key={i} row={row} index={i} leader={leaders[row.player_id]} intro={intro} />
        ))}
      </ol>

      <div className="grid gap-5 border-t border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8 sm:p-5">
        {audience !== "staff" && (
          <div className="sm:min-h-[84px]">
            {audienceLoading ? (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-8 w-24 animate-pulse rounded bg-white/[0.06]" />
              </div>
            ) : audience === "player" ? (
              <PlayerStory
                me={me}
                above={above}
                periodLabel={periodLabel}
                scopeLabel={scopeLabel}
                showDelta={showDelta}
              />
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-foreground-secondary">
                  Sigue tu lugar, tus partidas y tus stats.
                </p>
                <Link
                  to="/signup"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9"
                >
                  Crear cuenta
                </Link>
              </div>
            )}
          </div>
        )}
        <dl
          className={`grid grid-cols-3 gap-4 sm:flex sm:gap-x-8 ${
            audience === "staff" ? "sm:col-span-2" : ""
          }`}
        >
          {[
            ["Jugadores", stats.players],
            ["Tiendas", stats.stores],
            [stats.tournamentsLabel, stats.tournaments],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs text-foreground-subtle">{label}</dt>
              <dd className="font-mono-stat text-lg font-semibold text-foreground">
                {(value as number).toLocaleString("es-MX")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
