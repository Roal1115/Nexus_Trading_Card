import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, Gem, HelpCircle, Lock, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { playerAchievementsQuery } from "@/lib/player-profile-queries";
import { setEquippedTitle, setEquippedBadge, setEquippedNameplate } from "@/lib/nexus-player.functions";
import { getRewardKinds, isNameplateReward } from "@/lib/achievement-rewards";
import { NAMEPLATE_BANNER_STYLES, DEFAULT_NAMEPLATE_BANNER } from "@/lib/nameplate-styles";
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

// Categoría de filtro derivada del reward_type/title_text que ya trae cada
// item — sin tocar backend. reward_type es texto libre con ~15 variantes
// ("Champion Badge", "Seal + Frame + Title", ...) así que se agrupan en 3
// buckets simples en vez de un chip por cada string distinto.
type RewardCategory = "title" | "badge" | "other";
const FILTERS: Array<{ id: "all" | RewardCategory; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "title", label: "Títulos" },
  { id: "badge", label: "Badges" },
  { id: "other", label: "Otros" },
];
const getRewardCategory = (item: any): RewardCategory => {
  const kinds = getRewardKinds(item);
  if (kinds.includes("title")) return "title";
  if (kinds.includes("badge")) return "badge";
  return "other";
};

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

function AchievementCard({ item, isOwner, equip }: { item: any; isOwner: boolean; equip: EquipProps }) {
  const style = TIER_STYLES[item.tier] ?? DEFAULT_TIER_STYLE;
  const secretLocked = item.is_secret && !item.unlocked;

  // Slots equipables data-driven: cada uno se habilita si el item matchea
  // su regla y el jugador ya lo desbloqueó. Agregar un cuarto tipo (Frame,
  // Crest...) es una entrada más acá, no otro set de props/botones.
  const equipSlots = [
    {
      id: "title" as const,
      eligible: !!item.title_text,
      isEquipped: equip.equippedTitleKey === item.key,
      onToggle: equip.onEquipTitle,
      label: "title",
      activeClass: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
      idleClass: "sm:hover:border-fuchsia-500/40 sm:hover:text-fuchsia-300",
    },
    {
      id: "badge" as const,
      eligible: /badge/i.test(item.reward_type ?? ""),
      isEquipped: equip.equippedBadgeKey === item.key,
      onToggle: equip.onEquipBadge,
      label: "badge",
      activeClass: "border-primary/40 bg-primary/15 text-primary",
      idleClass: "sm:hover:border-primary/40 sm:hover:text-primary",
    },
    {
      id: "nameplate" as const,
      eligible: isNameplateReward(item),
      isEquipped: equip.equippedNameplateKey === item.key,
      onToggle: equip.onEquipNameplate,
      label: "nameplate",
      activeClass: "border-cyan-400/40 bg-cyan-400/15 text-cyan-300",
      idleClass: "sm:hover:border-cyan-400/40 sm:hover:text-cyan-300",
    },
  ].filter((slot) => isOwner && item.unlocked && slot.eligible);

  if (isNameplateReward(item)) {
    const banner = NAMEPLATE_BANNER_STYLES[item.tier] ?? DEFAULT_NAMEPLATE_BANNER;
    return (
      <div
        className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-150 ease-out active:scale-[0.98] sm:hover:-translate-y-0.5 ${
          item.unlocked
            ? `bg-gradient-to-r ${banner.gradient} ${banner.border} ${banner.glow}`
            : secretLocked
              ? "border-dashed border-white/15 bg-black/20"
              : "border-white/10 bg-black/20 grayscale sm:hover:grayscale-0"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${
              item.unlocked ? banner.icon : "border-white/15 bg-white/5 text-gray-500"
            }`}
          >
            {item.unlocked ? (
              <Gem size={18} />
            ) : secretLocked ? (
              <HelpCircle size={18} />
            ) : (
              <Lock size={16} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-base font-extrabold uppercase tracking-wide ${
                item.unlocked ? banner.text : secretLocked ? "italic text-gray-400" : "text-gray-300"
              }`}
            >
              {item.name}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{item.requirement_text}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
        {equipSlots.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {equipSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => slot.onToggle!(slot.isEquipped ? null : item.key)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition active:scale-95 ${
                  slot.isEquipped
                    ? slot.id === "nameplate"
                      ? banner.button
                      : slot.activeClass
                    : `border-white/15 bg-white/5 text-gray-300 ${slot.idleClass}`
                }`}
              >
                {slot.isEquipped ? `${slot.label} equipado ✓` : `Equipar ${slot.label}`}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

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
        {equipSlots.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {equipSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => slot.onToggle!(slot.isEquipped ? null : item.key)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition active:scale-95 ${
                  slot.isEquipped
                    ? slot.activeClass
                    : `border-white/15 bg-white/5 text-gray-300 ${slot.idleClass}`
                }`}
              >
                {slot.isEquipped ? `${slot.label} equipado ✓` : `Equipar ${slot.label}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type EquipProps = {
  isOwner: boolean;
  equippedTitleKey: string | null;
  onEquipTitle: (key: string | null) => void;
  equippedBadgeKey: string | null;
  onEquipBadge: (key: string | null) => void;
  equippedNameplateKey: string | null;
  onEquipNameplate: (key: string | null) => void;
};

// Grid con el toggle de secretos colapsados — compartido entre RoadSection
// (agrupado) y la lista plana filtrada, para no duplicar el patrón.
function SecretAwareGrid({ items, equip }: { items: any[]; equip: EquipProps }) {
  const visibleItems = items.filter((i: any) => !(i.is_secret && !i.unlocked));
  const hiddenSecrets = items.filter((i: any) => i.is_secret && !i.unlocked);
  const [showSecrets, setShowSecrets] = useState(false);

  const renderCard = (item: any) => (
    <AchievementCard key={item.key} item={item} isOwner={equip.isOwner} equip={equip} />
  );

  return (
    <>
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        {visibleItems.map(renderCard)}
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
            <div className="flex flex-col gap-3 pt-1 pb-2">
              {hiddenSecrets.map(renderCard)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function RoadSection({ road, equip }: { road: any; equip: EquipProps }) {
  const [unlocked, total] = road.unlocked_of_total.split("/").map(Number);
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <section
      id={roadAnchorId(road.road)}
      className="glass scroll-mt-32 overflow-hidden rounded-2xl border border-white/10"
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
      <SecretAwareGrid items={road.items} equip={equip} />
    </section>
  );
}

// Vista plana para un filtro de categoría (Título/Badge/Otros): sin Roads,
// desbloqueados primero (sort estable — a igualdad de estado conserva el
// sort_order del catálogo, que ya viene preservado en el orden de llegada).
function FilteredList({
  items,
  categoryLabel,
  equip,
}: {
  items: any[];
  categoryLabel: string;
  equip: EquipProps;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)),
    [items],
  );
  const unlockedCount = items.filter((i) => i.unlocked).length;

  if (items.length === 0) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-8 text-center text-sm text-gray-400">
        Todavía no hay achievements de {categoryLabel.toLowerCase()} en el catálogo.
      </section>
    );
  }

  return (
    <section className="glass overflow-hidden rounded-2xl border border-white/10">
      <header className="border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            {categoryLabel}
          </h2>
          <span className="text-xs uppercase tracking-wider text-gray-500">
            {unlockedCount}/{items.length}
          </span>
        </div>
      </header>
      <SecretAwareGrid items={sorted} equip={equip} />
    </section>
  );
}

function AchievementsHubPage() {
  const { playerTag } = Route.useParams();
  const loaderData = Route.useLoaderData();

  const query = useQuery({ ...playerAchievementsQuery(playerTag), initialData: loaderData });
  const data = query.data ?? null;
  const loading = query.isPending;

  const queryClient = useQueryClient();
  const equipTitleFn = useServerFn(setEquippedTitle);
  const equipBadgeFn = useServerFn(setEquippedBadge);
  const equipNameplateFn = useServerFn(setEquippedNameplate);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["player-achievements", playerTag] });
    queryClient.invalidateQueries({ queryKey: ["player-profile", playerTag] });
  };
  const handleEquipTitle = async (achievement_key: string | null) => {
    try {
      await equipTitleFn({ data: { achievement_key } });
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar el title");
    }
  };
  const handleEquipBadge = async (achievement_key: string | null) => {
    try {
      await equipBadgeFn({ data: { achievement_key } });
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar el badge");
    }
  };
  const handleEquipNameplate = async (achievement_key: string | null) => {
    try {
      await equipNameplateFn({ data: { achievement_key } });
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar el nameplate");
    }
  };

  const completionPercent =
    data && data.total_count > 0 ? Math.round((data.unlocked_count / data.total_count) * 100) : 0;

  const [filter, setFilter] = useState<"all" | RewardCategory>("all");
  const allItems = useMemo(() => data?.roads.flatMap((r: any) => r.items) ?? [], [data]);
  const categoryCounts = useMemo(() => {
    const counts: Record<RewardCategory, number> = { title: 0, badge: 0, other: 0 };
    for (const item of allItems) counts[getRewardCategory(item)]++;
    return counts;
  }, [allItems]);

  const equip: EquipProps = {
    isOwner: !!data?.is_owner,
    equippedTitleKey: data?.equipped_title_key ?? null,
    onEquipTitle: handleEquipTitle,
    equippedBadgeKey: data?.equipped_badge_key ?? null,
    onEquipBadge: handleEquipBadge,
    equippedNameplateKey: data?.equipped_nameplate_key ?? null,
    onEquipNameplate: handleEquipNameplate,
  };

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

      {/* Filtro por tipo de reward — "Todas" mantiene la vista agrupada por
          Road de siempre; cualquier otra categoría aplana el catálogo en
          una sola lista (desbloqueados primero), porque agrupar por Road
          "todos mis badges" solo generaría 7 secciones semivacías. */}
      <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-6">
        {FILTERS.map((f) => {
          const count = f.id === "all" ? data.total_count : categoryCounts[f.id];
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                active
                  ? "border-primary/50 bg-primary/15 text-white"
                  : "border-white/10 bg-white/5 text-gray-300 sm:hover:border-primary/30 sm:hover:text-white"
              }`}
            >
              {f.label} <span className="text-gray-500">{count}</span>
            </button>
          );
        })}
      </div>

      {filter === "all" ? (
        <>
          {/* Nav de Roads — sticky y con scroll horizontal: en mobile la página
              mide 10x+ el alto del viewport (7 roads x hasta 20 achievements),
              sin esto la única forma de llegar a "VII. The Legacy" es scrollear
              a ciegas. */}
          {/* top-16: el AppHeader global también es sticky top-0 (h-16, z-40) —
              sin este offset este nav se stackea DEBAJO del header en vez de
              quedar pegado justo después, y termina tapando el contenido al
              scrollear. */}
          {/* -mx-3/-mx-4 full-bleed edge-to-edge solo tiene sentido en mobile,
              donde el contenedor angosto hace que llegue casi al borde del
              viewport. En lg+ (max-w-3xl centrado) ese mismo negative margin
              deja un rectángulo sólido flotando contra el fondo con gradiente
              de la página — se resetea el margin y se le da forma de card. */}
          <div className="sticky top-16 z-10 -mx-3 mt-4 overflow-x-auto bg-background px-3 py-2 sm:-mx-4 sm:mt-6 sm:px-4 lg:mx-0 lg:rounded-xl lg:border lg:border-white/10">
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
              <RoadSection key={road.road} road={road} equip={equip} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 sm:mt-6">
          <FilteredList
            items={allItems.filter((item: any) => getRewardCategory(item) === filter)}
            categoryLabel={FILTERS.find((f) => f.id === filter)!.label}
            equip={equip}
          />
        </div>
      )}
    </main>
  );
}
