import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronLeft, HelpCircle, Lock, Sparkles, Trophy } from "lucide-react";
import { playerAchievementsQuery } from "@/lib/player-profile-queries";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/players/$playerTag_/achievements")({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(playerAchievementsQuery(params.playerTag));
    } catch {
      return undefined;
    }
  },
  head: ({ params }) => ({
    meta: [{ title: `Achievements de ${params.playerTag} — Nexus` }],
  }),
  component: AchievementsHubPage,
});

// Un solo mapa por tier: icon ring, pill de texto y acento del borde
// izquierdo + glow al hover salen de la misma paleta — así el tier se lee
// de un vistazo en vez de vivir solo en una etiqueta de 10px.
const TIER_STYLES: Record<
  string,
  { ring: string; pill: string; accent: string; glow: string }
> = {
  Bronze: {
    ring: "border-amber-700/40 bg-amber-900/10 text-amber-500",
    pill: "border-amber-700/40 bg-amber-900/20 text-amber-500",
    accent: "border-l-amber-600",
    glow: "sm:hover:shadow-[0_0_24px_-8px_rgba(180,83,9,0.6)] sm:hover:border-amber-600/60",
  },
  Silver: {
    ring: "border-gray-400/40 bg-gray-400/10 text-gray-300",
    pill: "border-gray-400/40 bg-gray-400/10 text-gray-300",
    accent: "border-l-gray-400",
    glow: "sm:hover:shadow-[0_0_24px_-8px_rgba(156,163,175,0.6)] sm:hover:border-gray-400/60",
  },
  Gold: {
    ring: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    pill: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    accent: "border-l-yellow-500",
    glow: "sm:hover:shadow-[0_0_24px_-8px_rgba(234,179,8,0.6)] sm:hover:border-yellow-500/60",
  },
  Platinum: {
    ring: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
    pill: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
    accent: "border-l-cyan-400",
    glow: "sm:hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.6)] sm:hover:border-cyan-400/60",
  },
  Legacy: {
    ring: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
    pill: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
    accent: "border-l-fuchsia-500",
    glow: "sm:hover:shadow-[0_0_24px_-8px_rgba(217,70,239,0.6)] sm:hover:border-fuchsia-500/60",
  },
  "Road Bonus": {
    ring: "border-primary/40 bg-primary/10 text-primary",
    pill: "border-primary/40 bg-primary/10 text-primary",
    accent: "border-l-primary",
    glow: "sm:hover:shadow-[0_0_24px_-8px_rgba(232,106,34,0.6)] sm:hover:border-primary/60",
  },
};
const DEFAULT_TIER_STYLE = TIER_STYLES.Silver;

// "I. The Journey" -> "I" para las pills de navegación (caben en una fila
// horizontal en mobile, que es donde más importa no perder espacio).
const roadShortLabel = (road: string) => road.split(".")[0];
const roadAnchorId = (road: string) => `road-${roadShortLabel(road).replace(/\s+/g, "-")}`;

// Anillo de completitud estilo Xbox/PSN trophy % — el % vive junto al
// título, no enterrado en una línea de texto.
function CompletionRing({ percent }: { percent: number }) {
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);
  return (
    <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center sm:h-16 sm:w-16">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-bold text-white sm:text-base">{percent}%</span>
    </div>
  );
}

function AchievementCard({ item }: { item: any }) {
  const style = TIER_STYLES[item.tier] ?? DEFAULT_TIER_STYLE;
  const secretLocked = item.is_secret && !item.unlocked;
  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border border-l-4 p-3 transition-all duration-150 ease-out active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:scale-[1.015] ${
        item.unlocked
          ? `border-white/10 bg-white/5 ${style.accent} ${style.glow}`
          : secretLocked
            ? "border-dashed border-white/10 border-l-white/15 bg-black/20 sm:hover:border-white/25 sm:hover:bg-black/30"
            : `border-white/5 border-l-white/10 bg-black/20 grayscale sm:hover:grayscale-0 sm:hover:border-white/15 ${style.glow}`
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-transform duration-150 group-hover:scale-110 ${
          item.unlocked ? style.ring : "border-white/15 bg-white/5 text-gray-500"
        }`}
      >
        {item.unlocked ? (
          <Trophy size={14} />
        ) : secretLocked ? (
          <HelpCircle size={14} />
        ) : (
          <Lock size={12} />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`text-sm font-semibold ${
            item.unlocked ? "text-white" : secretLocked ? "italic text-gray-400" : "text-gray-300"
          }`}
        >
          {item.name}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{item.requirement_text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              item.unlocked ? style.pill : "border-white/10 bg-white/5 text-gray-500"
            }`}
          >
            {item.tier}
          </span>
          <span className="text-[10px] font-semibold text-gray-500">+{item.base_lp} LP</span>
        </div>
        {item.reward_detail && (
          <p className="mt-1 text-[11px] leading-snug text-primary/80">{item.reward_detail}</p>
        )}
      </div>
    </div>
  );
}

function RoadSection({ road }: { road: any }) {
  // Secretos bloqueados colapsados por default — en mobile, un road con 10
  // "???" duplica el scroll sin darle al jugador nada que leer todavía.
  const visibleItems = road.items.filter((i: any) => !(i.is_secret && !i.unlocked));
  const hiddenSecrets = road.items.filter((i: any) => i.is_secret && !i.unlocked);
  const [showSecrets, setShowSecrets] = useState(false);

  const [unlocked, total] = road.unlocked_of_total.split("/").map(Number);
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <section
      id={roadAnchorId(road.road)}
      className="glass scroll-mt-16 overflow-hidden rounded-2xl border border-white/10"
    >
      <header className="border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">{road.road}</h2>
          <span className="text-xs uppercase tracking-wider text-gray-500">
            {road.unlocked_of_total}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
        {visibleItems.map((item: any) => (
          <AchievementCard key={item.key} item={item} />
        ))}
      </div>
      {hiddenSecrets.length > 0 && (
        <div className="border-t border-white/5 px-3 pb-3 sm:px-4">
          <button
            onClick={() => setShowSecrets((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-gray-400 transition active:scale-[0.98] sm:hover:text-gray-200"
          >
            <HelpCircle size={13} />
            {hiddenSecrets.length} logro{hiddenSecrets.length > 1 ? "s" : ""} secreto
            {hiddenSecrets.length > 1 ? "s" : ""} por descubrir
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${showSecrets ? "rotate-180" : ""}`}
            />
          </button>
          {showSecrets && (
            <div className="grid grid-cols-1 gap-3 pt-1 pb-2 sm:grid-cols-2">
              {hiddenSecrets.map((item: any) => (
                <AchievementCard key={item.key} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AchievementsHubPage() {
  const { playerTag } = Route.useParams();
  const loaderData = Route.useLoaderData();

  const query = useQuery({ ...playerAchievementsQuery(playerTag), initialData: loaderData });
  const data = query.data ?? null;
  const loading = query.isPending;

  const completionPercent =
    data && data.total_count > 0 ? Math.round((data.unlocked_count / data.total_count) * 100) : 0;

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <div className="mt-6 space-y-4">
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!data || data.roads.length === 0) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Sin achievements</h2>
        <p className="mt-2 text-sm text-gray-400">
          No hay achievements disponibles para este perfil.
        </p>
        <Link
          to="/players/$playerTag"
          params={{ playerTag }}
          className="mt-6 inline-block rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white"
        >
          Volver al perfil
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-10 lg:py-16">
      <Link
        to="/players/$playerTag"
        params={{ playerTag }}
        className="mb-4 inline-flex items-center gap-1 text-xs text-gray-400 active:text-white sm:mb-6 sm:hover:text-white"
      >
        <ChevronLeft size={14} /> Volver al perfil de {playerTag}
      </Link>

      <div className="glass rounded-2xl border border-white/10 p-4 sm:p-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <CompletionRing percent={completionPercent} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-white sm:text-2xl">
              Achievements de {playerTag}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white sm:text-sm">
                <Trophy size={13} className="text-primary" />
                {data.unlocked_count}
                <span className="font-normal text-gray-400">/ {data.total_count}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-300 sm:text-sm">
                <Sparkles size={13} />
                {data.total_lp}
                <span className="font-normal text-fuchsia-300/70">LP</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav de Roads — sticky y con scroll horizontal: en mobile la página
          mide 10x+ el alto del viewport (7 roads x hasta 20 achievements),
          sin esto la única forma de llegar a "VII. The Legacy" es scrollear
          a ciegas. */}
      <div className="sticky top-0 z-10 -mx-3 mt-4 overflow-x-auto bg-background/90 px-3 py-2 backdrop-blur sm:-mx-4 sm:mt-6 sm:px-4">
        <div className="flex w-max gap-1.5">
          {data.roads.map((road: any) => (
            <a
              key={road.road}
              href={`#${roadAnchorId(road.road)}`}
              className="flex-shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition active:scale-95 sm:hover:border-primary/40 sm:hover:text-white"
            >
              {roadShortLabel(road.road)}{" "}
              <span className="text-gray-500">{road.unlocked_of_total}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
        {data.roads.map((road: any) => (
          <RoadSection key={road.road} road={road} />
        ))}
      </div>
    </main>
  );
}
