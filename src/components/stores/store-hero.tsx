import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Navigation, Star } from "lucide-react";
import { fullDate } from "@/components/calendar/tournament-detail-dialog";
import { acceptsSlotRsvp, SlotRsvpPanel } from "@/components/calendar/slot-rsvp";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton-loader";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { publicCalendarQuery } from "@/lib/calendar-queries";
import { getMyFavoriteStores, toggleFavoriteStore } from "@/lib/nexus-player.functions";
import { storeFichasQuery } from "@/lib/stores-queries";
import {
  mondayOfWeek,
  nowInMexicoTimeStr,
  safeHref,
  todayInMexicoStr,
  toLocalDateStr,
} from "@/lib/utils";

// Un torneo por semana: seis semanas dejan cuatro fechas aunque se cancelen dos.
const WEEKS_AHEAD = 6;

/** Fechas de torneo de la tienda que aún no empiezan, incluidas las canceladas. */
export function useStoreUpcoming(storeId: string | undefined) {
  const today = todayInMexicoStr();
  const monday = mondayOfWeek(new Date(`${today}T12:00:00`));
  const results = useQueries({
    queries: Array.from({ length: WEEKS_AHEAD }, (_, i) => {
      const week = new Date(monday);
      week.setDate(monday.getDate() + i * 7);
      return {
        ...publicCalendarQuery({
          game_id: null,
          zone: null,
          store_id: storeId ?? null,
          store_ids: null,
          week_start: toLocalDateStr(week),
        }),
        placeholderData: undefined,
        enabled: !!storeId,
      };
    }),
  });
  const nowTime = nowInMexicoTimeStr();
  const upcoming = results
    .flatMap((r) => (r.data?.events ?? []) as any[])
    .filter(
      (e) => e.date > today || (e.date === today && (!e.time || e.time.slice(0, 5) > nowTime)),
    );
  return { upcoming, loading: results.some((r) => r.isPending) };
}

function FavoriteButton({ storeId }: { storeId: string }) {
  const { player } = useNexusRole();
  const fetchFavorites = useServerFn(getMyFavoriteStores);
  const toggleFavorite = useServerFn(toggleFavoriteStore);
  const [isFavorite, setIsFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!player?.id) {
      setIsFavorite(false);
      return;
    }
    // Una respuesta vieja no debe pisar a la más reciente.
    let cancelled = false;
    fetchFavorites()
      .then((res: any) => {
        if (!cancelled) setIsFavorite((res.store_ids ?? []).includes(storeId));
      })
      .catch(() => {
        if (!cancelled) setIsFavorite(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, storeId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setIsFavorite((v) => !v);
    try {
      const res: any = await toggleFavorite({ data: { store_id: storeId } });
      setIsFavorite(res.is_favorite);
    } catch {
      setIsFavorite((v) => !v);
    } finally {
      setBusy(false);
    }
  }

  if (!player) return null;
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Quitar de favoritas" : "Agregar a favoritas"}
      title={isFavorite ? "Quitar de favoritas" : "Agregar a favoritas"}
      className={`flex-shrink-0 rounded-full border p-2.5 transition ${
        isFavorite
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-white/10 text-gray-400 hover:border-primary/40 hover:text-primary"
      }`}
    >
      <Star size={18} className={isFavorite ? "fill-primary" : ""} />
    </button>
  );
}

function NextTournament({ storeId }: { storeId: string }) {
  const { player } = useNexusRole();
  const { upcoming, loading } = useStoreUpcoming(storeId);
  const { data: fichas } = useQuery(storeFichasQuery(storeId));

  if (loading) {
    return (
      <div className="space-y-2">
        <SkeletonLine width="w-24" height="h-3" />
        <SkeletonLine width="w-2/3" height="h-6" />
        <SkeletonBlock className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  const next = upcoming.find((e) => !e.cancellation_reason);
  const cancelledFirst = upcoming[0]?.cancellation_reason ? upcoming[0] : null;
  const ficha = next && fichas?.items.find((item) => item.game_id === next.game_id);
  const facts = next
    ? [
        ficha?.current
          ? ficha.current.entry_fee_mxn === 0
            ? "Gratis"
            : `$${ficha.current.entry_fee_mxn} MXN`
          : "Costo por confirmar",
        ficha?.format,
        ficha?.capacity ? `${ficha.capacity} jugadores` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-start">
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <CalendarDays size={13} /> Próximo torneo
        </p>
        {cancelledFirst && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <strong>{fullDate(cancelledFirst.date)}: cancelado.</strong>{" "}
            {cancelledFirst.cancellation_reason}
          </p>
        )}
        {next ? (
          <>
            <h2 className="text-xl font-bold text-white">
              {fullDate(next.date)}
              {next.time ? ` · ${next.time.slice(0, 5)} hrs` : ""}
            </h2>
            <p className="text-sm text-gray-300">{facts.join(" · ")}</p>
            {next.league_name && <p className="text-xs text-gray-400">{next.league_name}</p>}
          </>
        ) : (
          <p className="text-sm text-gray-400">
            Esta tienda no tiene torneos programados por ahora.
          </p>
        )}
      </div>
      {next && acceptsSlotRsvp(next) && <SlotRsvpPanel entry={next} playerId={player?.id} />}
    </div>
  );
}

/** Encabezado de la tienda, visible en todas sus pestañas. */
export function StoreHero({ store }: { store: any }) {
  const mapsUrl = safeHref(store.google_maps_url);
  return (
    <header className="glass space-y-4 rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            {[store.zone, store.subzone].filter(Boolean).join(" · ") || "—"}
          </p>
          <h1 className="text-3xl font-bold text-white">{store.name}</h1>
          {store.games.length > 0 && (
            <p className="text-sm text-gray-400">
              {store.games.map((g: any) => g.name).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:border-primary/40"
            >
              <Navigation size={13} /> Cómo llegar
            </a>
          )}
          <FavoriteButton storeId={store.id} />
        </div>
      </div>
      <div className="border-t border-white/10 pt-4">
        <NextTournament storeId={store.id} />
      </div>
    </header>
  );
}
