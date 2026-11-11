import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { fullDate } from "@/components/calendar/tournament-detail-dialog";
import { acceptsSlotRsvp, SlotRsvpPanel } from "@/components/calendar/slot-rsvp";
import { BTN_OUTLINE, FOCUS_RING, InlineError, SECTION } from "@/components/stores/store-ui";
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
  return {
    upcoming,
    loading: results.some((r) => r.isPending),
    // Una semana que falla no es "sin torneos": se avisa para no decirle al visitante que la
    // tienda está inactiva cuando solo falló la red.
    error: results.some((r) => r.isError),
    retry: () => results.forEach((r) => r.isError && r.refetch()),
  };
}

function FavoriteButton({ storeId, storeName }: { storeId: string; storeName: string }) {
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
  const label = isFavorite
    ? `Quitar ${storeName} de favoritas`
    : `Marcar ${storeName} como favorita`;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isFavorite}
      aria-label={label}
      title={label}
      className={`flex min-h-11 min-w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border border-border transition hover:bg-white/5 disabled:opacity-40 sm:min-h-9 sm:min-w-9 ${FOCUS_RING} ${
        isFavorite ? "text-warning" : "text-foreground-subtle hover:text-warning"
      }`}
    >
      <Star size={18} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

function NextTournament({ storeId }: { storeId: string }) {
  const { player } = useNexusRole();
  const { upcoming, loading, error, retry } = useStoreUpcoming(storeId);
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
    <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_240px] @2xl:items-start">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-foreground-secondary">Próximo torneo</h2>
        {cancelledFirst && (
          <p className="text-sm text-destructive">
            <strong>{fullDate(cancelledFirst.date)}: cancelado.</strong>{" "}
            {cancelledFirst.cancellation_reason}
          </p>
        )}
        {next ? (
          <>
            <p className="text-xl font-bold text-foreground">
              {fullDate(next.date)}
              {next.time ? ` · ${next.time.slice(0, 5)} hrs` : ""}
            </p>
            <p className="text-sm text-foreground-secondary">{facts.join(" · ")}</p>
            {next.league_name && (
              <p className="text-sm text-foreground-subtle">{next.league_name}</p>
            )}
          </>
        ) : error ? (
          <InlineError onRetry={retry}>No pudimos cargar las próximas fechas.</InlineError>
        ) : (
          <p className="text-sm text-foreground-secondary">
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
  const place = [store.zone, store.subzone].filter(Boolean).join(" · ");
  return (
    <header className={`${SECTION} space-y-4`}>
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-balance break-words text-2xl font-bold text-foreground @2xl:text-3xl">
            {store.name}
          </h1>
          {place && <p className="text-sm text-foreground-secondary">{place}</p>}
          {store.games.length > 0 && (
            <p className="text-sm text-foreground-subtle">
              {store.games.map((g: any) => g.name).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE}>
              Cómo llegar
              <span className="sr-only"> a {store.name} (se abre en otra pestaña)</span>
            </a>
          )}
          <FavoriteButton storeId={store.id} storeName={store.name} />
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <NextTournament storeId={store.id} />
      </div>
    </header>
  );
}
