import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Trash2, ChevronRight, ChevronDown, X, Search, Loader2, Images } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  getStandaloneSessions,
  deleteStandaloneSession,
  createStandaloneSession,
  searchStores,
  getMyTrackedTournaments,
} from "@/lib/nexus-standalone.functions";
import { getMySessionGames } from "@/lib/nexus-player.functions";
import { cancelSlotRsvp, getMySlotsToLog } from "@/lib/nexus-rsvp.functions";
import { getDeckIdentifiers } from "@/lib/nexus-tournament-tracker.functions";
import { cleanLeaderName } from "@/components/tournament-tracker/round-ui";
import { ColorDots } from "@/components/tournament-tracker/color-dots";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  ChipGroup,
  FOCUS_RING,
  INPUT,
  InlineError,
  LABEL,
  SECTION,
} from "@/components/stores/store-ui";
import { sessionsPageQuery } from "@/lib/sessions-queries";

type DeckIdentifier = {
  id: string;
  base_name: string;
  colors: string[] | null;
  card_image: string | null;
  card_set_id: string | null;
};

export const Route = createFileRoute("/sessions/")({
  head: () => ({ meta: [{ title: "Mis partidas — Nexus" }] }),
  // Si el loader falla no tumba la ruta: la query del cliente reintenta y la página muestra el error.
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(sessionsPageQuery());
    } catch {
      return undefined;
    }
  },
  component: SessionsPage,
});

type SessionsResult = Awaited<ReturnType<typeof getStandaloneSessions>>;
type SessionRow = SessionsResult["sessions"][number];
type TrackedTournamentsResult = Awaited<ReturnType<typeof getMyTrackedTournaments>>;
type TrackedTournament = TrackedTournamentsResult["tournaments"][number];
type SlotToLog = Awaited<ReturnType<typeof getMySlotsToLog>>["slots"][number];

/** "10 nov"; el año solo si no es el actual. */
function formatShortDate(date: string | null): string {
  if (!date) return "Sin fecha";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Récord V–D en mono; en Casual va neutro porque no cuenta para el ranking. */
function RecordCell({ wins, losses, muted }: { wins: number; losses: number; muted?: boolean }) {
  const decided = wins + losses;
  if (decided === 0) return <p className="text-sm text-foreground-subtle">Sin rondas</p>;
  const winRate = Math.round((wins / decided) * 100);
  return (
    <div className="text-right">
      <p className="whitespace-nowrap font-mono-stat text-lg font-bold">
        <span className={muted ? "text-foreground-secondary" : "text-success"}>{wins}V</span>
        <span className="text-foreground-subtle">–</span>
        <span className={muted ? "text-foreground-secondary" : "text-danger"}>{losses}D</span>
      </p>
      <p className="whitespace-nowrap font-mono-stat text-xs text-foreground-subtle">
        {winRate}% victorias
      </p>
    </div>
  );
}

// Enlace estirado: toda la fila es el área de toque y el foco se dibuja en el ::after.
const TITLE_LINK =
  "block truncate text-base font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-primary/50";

function SessionCard({
  session,
  onDelete,
  isDeleting,
  showGame,
}: {
  session: SessionRow;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  showGame: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const meta = [
    formatShortDate(session.session_date),
    session.store_name,
    showGame ? session.game_name : null,
    session.leader ? cleanLeaderName(session.leader.base_name) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="relative flex items-center gap-3 py-3 transition hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <Link to="/sessions/$sessionId" params={{ sessionId: session.id }} className={TITLE_LINK}>
          {session.name}
        </Link>
        <p className="truncate text-sm text-foreground-secondary">{meta}</p>
      </div>

      {session.leader?.card_image && (
        <img
          src={session.leader.card_image}
          alt={session.leader.base_name}
          loading="lazy"
          decoding="async"
          className="hidden h-14 w-10 flex-shrink-0 rounded-md border border-border object-cover sm:block"
        />
      )}

      <RecordCell wins={session.wins} losses={session.losses} muted={session.status === "casual"} />

      {session.status !== "matched" && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Eliminar ${session.name}`}
          className={`relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-foreground-subtle transition hover:bg-destructive/10 hover:text-danger sm:h-9 sm:w-9 ${FOCUS_RING}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
      <ChevronRight
        size={16}
        aria-hidden="true"
        className="hidden flex-shrink-0 text-foreground-subtle sm:block"
      />

      {/* Confirmación de borrado: cubre la fila, sin blur */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="alertdialog"
            aria-label={`Eliminar ${session.name}`}
            className="absolute inset-0 z-20 flex items-center justify-between gap-3 bg-card"
          >
            <span className="truncate text-sm font-medium text-foreground">
              ¿Eliminar "{session.name}"?
            </span>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onDelete(session.id);
                  setConfirming(false);
                }}
                disabled={isDeleting}
                className={`inline-flex min-h-11 items-center rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50 sm:min-h-9 ${FOCUS_RING}`}
              >
                {isDeleting ? "Eliminando…" : "Eliminar"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={BTN_OUTLINE}>
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function TrackedTournamentCard({
  tournament,
  showGame,
}: {
  tournament: TrackedTournament;
  showGame: boolean;
}) {
  const meta = [
    formatShortDate(tournament.tournament_date),
    showGame ? tournament.game_name : null,
    `${tournament.total_rounds} ${tournament.total_rounds === 1 ? "ronda" : "rondas"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="relative flex items-center gap-3 py-3 transition hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <Link
          to="/sessions/tournament/$tournamentId"
          params={{ tournamentId: tournament.id }}
          className={TITLE_LINK}
        >
          {tournament.store_name}
        </Link>
        <p className="truncate text-sm text-foreground-secondary">{meta}</p>
      </div>
      <RecordCell wins={tournament.wins} losses={tournament.losses} />
      <ChevronRight
        size={16}
        aria-hidden="true"
        className="hidden flex-shrink-0 text-foreground-subtle sm:block"
      />
    </li>
  );
}

// ============================================================
// Section — una superficie plana por grupo; filas separadas con líneas
// ============================================================
function Section({
  title,
  count,
  subtitle,
  children,
}: {
  title: string;
  count: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className={`${SECTION} mt-6`}>
      <h2 className="text-lg font-semibold text-foreground">
        {title}{" "}
        <span className="font-mono-stat text-sm font-normal text-foreground-subtle">{count}</span>
      </h2>
      {subtitle && <p className="mt-1 text-sm text-foreground-secondary">{subtitle}</p>}
      <ul className="mt-2 divide-y divide-border">{children}</ul>
    </section>
  );
}

function SessionsPage() {
  const { player, loading: roleLoading } = useNexusRole();
  const removeSession = useServerFn(deleteStandaloneSession);
  const loaderData = Route.useLoaderData();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [prefill, setPrefill] = useState<SlotToLog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fetchSlotsToLog = useServerFn(getMySlotsToLog);
  const cancelSlot = useServerFn(cancelSlotRsvp);

  const { data, isLoading, isError, refetch } = useQuery({
    ...sessionsPageQuery(),
    enabled: !!player,
    initialData: loaderData,
  });
  const sessions = data?.sessions ?? [];
  const allTracked = data?.tournaments ?? [];

  const slotsKey = ["slots-to-log", player?.id];
  const {
    data: slotsData,
    isError: slotsError,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: slotsKey,
    queryFn: () => fetchSlotsToLog(),
    enabled: !!player,
  });
  const slotsToLog = slotsData?.slots ?? [];
  const skipSlot = useMutation({
    mutationFn: ({ store_id, game_id, date }: SlotToLog) =>
      cancelSlot({ data: { store_id, game_id, date } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slotsKey }),
    onError: (e: Error) => toast.error(e.message || "No pudimos quitar este torneo de tu lista"),
  });
  const loading = roleLoading || (!!player && isLoading && !data);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeSession({ data: { session_id: id } }),
    onMutate: (id) => setDeletingId(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData(sessionsPageQuery().queryKey, (prev: typeof data) =>
        prev ? { ...prev, sessions: prev.sessions.filter((s) => s.id !== id) } : prev,
      );
      toast.success("Partida eliminada");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar la partida"),
    onSettled: () => setDeletingId(null),
  });
  const handleDelete = (id: string) => deleteMutation.mutate(id);

  if (!roleLoading && !player) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className={`${SECTION} p-8 text-center`}>
          <h1 className="text-xl font-bold text-foreground">Debes iniciar sesión</h1>
          <p className="mt-2 text-sm text-foreground-secondary">
            Inicia sesión para ver y crear tus partidas.
          </p>
          <Link to="/login" className={`${BTN_PRIMARY} mt-5`}>
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  const pendingSessions = sessions.filter((s) => s.status === "unlinked");
  const matchedSessions = sessions.filter((s) => s.status === "matched");
  const casualSessions = sessions.filter((s) => s.status === "casual");
  // Una partida vinculada también aparece como torneo con rondas: mostrarla una sola vez.
  const linkedIds = new Set(matchedSessions.map((s) => s.tournament_id));
  const trackedTournaments = allTracked.filter((t) => !linkedIds.has(t.id));
  const officialCount = matchedSessions.length + trackedTournaments.length;

  // Resumen de temporada: solo lo oficial (lo casual no cuenta para el ranking).
  const officialRows = [...matchedSessions, ...trackedTournaments];
  const officialWins = officialRows.reduce((n, r) => n + r.wins, 0);
  const officialLosses = officialRows.reduce((n, r) => n + r.losses, 0);
  const officialDecided = officialWins + officialLosses;
  const officialWinRate =
    officialDecided > 0 ? Math.round((officialWins / officialDecided) * 100) : null;

  // El juego solo se repite en cada fila si el jugador tiene más de uno.
  const showGame =
    new Set([...sessions.map((s) => s.game_name), ...allTracked.map((t) => t.game_name)]).size > 1;

  const loadFailed = !!player && isError && !data;
  const isEmpty = !loading && !loadFailed && sessions.length === 0 && allTracked.length === 0;

  const openCreateSheet = () => setShowCreateSheet(true);

  return (
    <main className="@container mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-6 sm:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Mis partidas</h1>

        {/* Crear (escritorio): la única acción en cian de la pantalla */}
        <div className="hidden sm:block">
          <button type="button" onClick={openCreateSheet} className={BTN_PRIMARY}>
            <Plus size={16} aria-hidden="true" />
            Nueva partida
          </button>
        </div>
      </div>

      {isError && !loadFailed && (
        <div className={`${SECTION} mt-6`}>
          <InlineError onRetry={() => void refetch()}>
            No pudimos actualizar tus partidas. Ves los últimos datos cargados.
          </InlineError>
        </div>
      )}

      {slotsError ? (
        <div className={`${SECTION} mt-6`}>
          <InlineError onRetry={() => void refetchSlots()}>
            No pudimos cargar tus torneos por registrar.
          </InlineError>
        </div>
      ) : (
        <Section
          title="Registra tu partida"
          count={slotsToLog.length}
          subtitle="Marcaste que te interesaba ir a estos torneos. Los datos ya vienen llenos."
        >
          {slotsToLog.map((slot) => (
            <li
              key={`${slot.store_id}_${slot.date}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {slot.store_name}
                </p>
                <p className="text-sm text-foreground-secondary">
                  {formatShortDate(slot.date)}
                  {slot.time ? ` · ${slot.time}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => skipSlot.mutate(slot)}
                  disabled={skipSlot.isPending}
                  className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground-secondary transition hover:bg-white/5 hover:text-foreground disabled:opacity-60 sm:min-h-9 ${FOCUS_RING}`}
                >
                  No fui
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefill(slot);
                    openCreateSheet();
                  }}
                  className={BTN_OUTLINE}
                >
                  Registrar
                </button>
              </div>
            </li>
          ))}
        </Section>
      )}

      {/* Contenido */}
      {loading ? (
        <div className={`${SECTION} mt-6 space-y-3`} aria-busy="true">
          <SkeletonBlock className="h-6 w-56" />
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
        </div>
      ) : loadFailed ? (
        <div className={`${SECTION} mt-6`}>
          <InlineError onRetry={() => void refetch()}>No pudimos cargar tus partidas.</InlineError>
        </div>
      ) : isEmpty ? (
        <div className={`${SECTION} mt-6 px-6 py-12 text-center`}>
          <h2 className="text-lg font-semibold text-foreground">Aún no registras partidas</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-foreground-secondary">
            Crea tu primera partida para empezar a registrar tus rondas.
          </p>
          <button type="button" onClick={openCreateSheet} className={`${BTN_PRIMARY} mt-5`}>
            <Plus size={16} aria-hidden="true" />
            Nueva partida
          </button>
        </div>
      ) : (
        <>
          {/* Resumen oficial de la temporada */}
          {officialCount > 0 && (
            <dl className={`${SECTION} mt-6 grid grid-cols-3 divide-x divide-border !p-0`}>
              <div className="px-4 py-3 text-center sm:py-4">
                <dt className="text-xs text-foreground-subtle">Torneos</dt>
                <dd className="mt-1 font-mono-stat text-xl font-bold text-foreground sm:text-2xl">
                  {officialCount}
                </dd>
              </div>
              <div className="px-4 py-3 text-center sm:py-4">
                <dt className="text-xs text-foreground-subtle">Récord</dt>
                <dd className="mt-1 whitespace-nowrap font-mono-stat text-xl font-bold sm:text-2xl">
                  <span className="text-success">{officialWins}V</span>
                  <span className="text-foreground-subtle">–</span>
                  <span className="text-danger">{officialLosses}D</span>
                </dd>
              </div>
              <div className="px-4 py-3 text-center sm:py-4">
                <dt className="text-xs text-foreground-subtle">Win rate</dt>
                <dd className="mt-1 font-mono-stat text-xl font-bold text-foreground sm:text-2xl">
                  {officialWinRate !== null ? `${officialWinRate}%` : "—"}
                </dd>
              </div>
            </dl>
          )}

          {/* 1. Pendientes de vincular */}
          <Section
            title="Pendientes de vincular"
            count={pendingSessions.length}
            subtitle="Vincular es asociar tu partida a su torneo oficial para que cuente en el ranking. Se vinculan solas al publicarse el torneo; si ya se publicó, abre la partida y vincúlala a mano."
          >
            {pendingSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onDelete={handleDelete}
                isDeleting={deletingId === s.id}
                showGame={showGame}
              />
            ))}
          </Section>

          {/* 2. Torneos oficiales: sesiones matched + performance tracker, una sola lista */}
          <Section
            title="Torneos oficiales"
            count={officialCount}
            subtitle="Vinculadas a un torneo oficial."
          >
            {matchedSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onDelete={handleDelete}
                isDeleting={deletingId === s.id}
                showGame={showGame}
              />
            ))}
            {trackedTournaments.map((t) => (
              <TrackedTournamentCard key={t.id} tournament={t} showGame={showGame} />
            ))}
          </Section>

          {/* 3. Casual */}
          <Section
            title="Casual"
            count={casualSessions.length}
            subtitle="Prácticas y partidas fuera de torneo. No cuentan para tu ranking."
          >
            {casualSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onDelete={handleDelete}
                isDeleting={deletingId === s.id}
                showGame={showGame}
              />
            ))}
          </Section>
        </>
      )}

      {/* Crear (móvil, fijo) */}
      <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 sm:hidden">
        <button type="button" onClick={openCreateSheet} className={`${BTN_PRIMARY} shadow-2xl`}>
          <Plus size={16} aria-hidden="true" />
          Nueva partida
        </button>
      </div>

      <CreateSessionSheet
        open={showCreateSheet}
        prefill={prefill}
        onClose={() => {
          setShowCreateSheet(false);
          setPrefill(null);
        }}
        onCreated={(created) => {
          setShowCreateSheet(false);
          setPrefill(null);
          queryClient.invalidateQueries({ queryKey: slotsKey });
          // Vinculada a un torneo ya publicado: las rondas (y el rival de cada una) se
          // registran en el torneo oficial, como en el dashboard.
          if (created.status === "matched" && created.tournament_id) {
            navigate({
              to: "/sessions/tournament/$tournamentId",
              params: { tournamentId: created.tournament_id },
              search: { editar: true },
            });
          } else {
            navigate({ to: "/sessions/$sessionId", params: { sessionId: created.id } });
          }
        }}
      />
    </main>
  );
}

// ============================================================
// LeaderArtSwitcher — pick a different art/printing for the same card_set_id
// ============================================================
function LeaderArtSwitcher({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: DeckIdentifier;
  onChange: (d: DeckIdentifier) => void;
}) {
  const fetchLeaders = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<DeckIdentifier[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!open || !value.card_set_id) return;
    setVariants(null);
    setFailed(false);
    fetchLeaders({ data: { game_id: gameId, card_set_id: value.card_set_id } })
      .then((rows) => setVariants(rows as DeckIdentifier[]))
      .catch(() => setFailed(true));
  }, [open, value.card_set_id, gameId, fetchLeaders, retryKey]);

  return (
    <div className="mt-2">
      <div className="relative inline-block">
        <img
          src={value.card_image ?? undefined}
          alt={value.base_name}
          className="h-20 max-w-full rounded-md border border-border object-contain"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Cambiar arte"
          aria-label="Cambiar arte"
          aria-expanded={open}
          className={`absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-popover text-foreground-secondary transition hover:text-foreground ${FOCUS_RING}`}
        >
          <Images size={14} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {failed ? (
                <InlineError onRetry={() => setRetryKey((k) => k + 1)}>
                  No pudimos cargar las artes.
                </InlineError>
              ) : variants === null ? (
                <p role="status" className="text-xs text-foreground-subtle">
                  Buscando artes…
                </p>
              ) : variants.length === 0 ? (
                <p className="text-xs text-foreground-subtle">Esta carta no tiene otras artes.</p>
              ) : (
                variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-label={`Arte ${v.card_set_id ?? v.base_name}`}
                    onClick={() => {
                      onChange(v);
                      setOpen(false);
                    }}
                    className={`flex-shrink-0 overflow-hidden rounded-md border transition ${FOCUS_RING} ${
                      v.id === value.id
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-foreground-subtle"
                    }`}
                  >
                    {v.card_image ? (
                      <img
                        src={v.card_image}
                        alt={v.base_name}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-11 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-11 items-center justify-center bg-muted text-xs text-foreground-subtle">
                        ?
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// LeaderSelect — selecciona el leader/deck propio de la sesión
// ============================================================
function LeaderSelect({
  gameId,
  value,
  onChange,
}: {
  gameId: string | null;
  value: DeckIdentifier | null;
  onChange: (d: DeckIdentifier | null) => void;
}) {
  const fetchLeaders = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<DeckIdentifier[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!open || !gameId) return;
    setOptions(null);
    setFailed(false);
    const t = setTimeout(() => {
      fetchLeaders({
        data: { game_id: gameId, search: search || undefined, basic_only: true },
      })
        .then((rows) => setOptions(rows as DeckIdentifier[]))
        .catch(() => setFailed(true));
    }, 200);
    return () => clearTimeout(t);
  }, [open, search, gameId, fetchLeaders, retryKey]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!gameId}
        aria-expanded={open}
        className={`flex min-h-11 w-full items-center justify-between rounded-md border border-border px-3 text-sm text-foreground disabled:opacity-50 ${FOCUS_RING}`}
      >
        <span className="truncate">
          {value ? (
            cleanLeaderName(value.base_name)
          ) : (
            <span className="text-foreground-subtle">Selecciona tu leader…</span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="flex-shrink-0 text-foreground-subtle"
        />
      </button>

      {open && (
        <div
          ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
          className="mt-1 rounded-md border border-border bg-secondary"
        >
          <div className="relative p-2">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-foreground-subtle"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar leader"
              placeholder="Buscar leader o ID (ej. OP10-010)…"
              className={`${INPUT} pl-9`}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {failed ? (
              <div className="px-3 py-3">
                <InlineError onRetry={() => setRetryKey((k) => k + 1)}>
                  No pudimos cargar los leaders.
                </InlineError>
              </div>
            ) : options === null ? (
              <p role="status" className="px-3 py-3 text-sm text-foreground-subtle">
                Buscando leaders…
              </p>
            ) : options.length === 0 ? (
              <p className="px-3 py-3 text-sm text-foreground-subtle">
                {search.trim() ? `Sin leaders para “${search.trim()}”.` : "Sin leaders."}
              </p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition hover:bg-white/5"
                >
                  <span className="flex-shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs uppercase text-foreground-secondary">
                    {opt.card_set_id}
                  </span>
                  <span className="flex-1 truncate">{cleanLeaderName(opt.base_name)}</span>
                  <ColorDots colors={opt.colors} />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {value?.card_image && gameId && (
        <LeaderArtSwitcher gameId={gameId} value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ============================================================
// CreateSessionSheet
// ============================================================
type Game = { id: string; name: string; slug: string };
type CreatedSession = { id: string; status: string; tournament_id: string | null };
type StoreRow = { id: string; name: string; city: string | null; zone: string | null };

/** "Torneo del martes — Guarida Gamer": el mismo nombre que usa el prellenado desde un RSVP. */
function suggestTournamentName(date: string, storeName: string): string {
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long" });
  return `Torneo del ${weekday} — ${storeName}`.slice(0, 100);
}

function CreateSessionSheet({
  open,
  prefill,
  onClose,
  onCreated,
}: {
  open: boolean;
  prefill: SlotToLog | null;
  onClose: () => void;
  onCreated: (session: CreatedSession) => void;
}) {
  const fetchGames = useServerFn(getMySessionGames);
  const searchStoresFn = useServerFn(searchStores);
  const createSession = useServerFn(createStandaloneSession);

  const [step, setStep] = useState<1 | 2>(1);
  const [sessionType, setSessionType] = useState<"competitive" | "casual" | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesFailed, setGamesFailed] = useState(false);
  const [gamesRetry, setGamesRetry] = useState(0);

  const [name, setName] = useState("");
  // Mientras el jugador no escriba un nombre, se sugiere uno con la tienda y la fecha.
  const [nameTouched, setNameTouched] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [leader, setLeader] = useState<DeckIdentifier | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [storeResults, setStoreResults] = useState<StoreRow[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [storeSearching, setStoreSearching] = useState(false);
  const [storeFailed, setStoreFailed] = useState(false);
  const [storeRetry, setStoreRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // El diálogo se monta en document.body (The Portal Rule).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Foco: entra al diálogo al abrir y regresa al botón que lo abrió al cerrar. Escape cierra.
  // onClose va en ref: el padre lo pasa inline y no debe reiniciar este efecto en cada render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panelRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1);
        setSessionType(null);
        setName("");
        setNameTouched(false);
        setGameId(null);
        setLeader(null);
        setDate("");
        setTime("");
        setStoreQuery("");
        setStoreResults([]);
        setSelectedStore(null);
        setStoreDropdownOpen(false);
        setStoreFailed(false);
        setSubmitting(false);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !prefill) return;
    setSessionType("competitive");
    setStep(2);
    setName(suggestTournamentName(prefill.date, prefill.store_name));
    setGameId(prefill.game_id);
    setDate(prefill.date);
    setTime(prefill.time);
    setSelectedStore({
      id: prefill.store_id,
      name: prefill.store_name,
      city: prefill.store_city,
      zone: prefill.store_zone,
    });
  }, [open, prefill]);

  // Nombre sugerido para un torneo oficial, hasta que el jugador lo edite.
  useEffect(() => {
    if (sessionType !== "competitive" || nameTouched || prefill) return;
    setName(date && selectedStore ? suggestTournamentName(date, selectedStore.name) : "");
  }, [sessionType, nameTouched, prefill, date, selectedStore]);

  // Load games when opening
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGamesLoading(true);
    setGamesFailed(false);
    (async () => {
      try {
        const res = await fetchGames();
        if (cancelled) return;
        const list = (res.games ?? []) as Game[];
        setGames(list);
        setGameId((prev) => prev ?? list[0]?.id ?? null);
      } catch {
        if (!cancelled) setGamesFailed(true);
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fetchGames, gamesRetry]);

  // Store search debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setStoreFailed(false);
    if (!storeQuery.trim() || sessionType !== "competitive") {
      setStoreResults([]);
      setStoreSearching(false);
      return;
    }
    setStoreSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await searchStoresFn({ data: { search: storeQuery.trim() } });
        setStoreResults(res.stores);
      } catch {
        setStoreResults([]);
        setStoreFailed(true);
      } finally {
        setStoreSearching(false);
      }
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [storeQuery, sessionType, searchStoresFn, storeRetry]);

  // Lo que falta, en el orden del formulario; vacío = se puede crear.
  const missing = useMemo(() => {
    const out: string[] = [];
    if (sessionType === "competitive") {
      if (!selectedStore) out.push("tienda");
      if (!date) out.push("fecha");
      if (!time) out.push("hora");
    }
    if (!name.trim()) out.push("nombre");
    if (!gameId) out.push("TCG");
    return out;
  }, [sessionType, name, gameId, date, time, selectedStore]);
  const canSubmit = !!sessionType && missing.length === 0;

  const handleSubmit = async () => {
    if (!canSubmit || !sessionType || !gameId) return;
    setSubmitting(true);
    try {
      const payload: {
        session_type: "competitive" | "casual";
        name: string;
        game_id: string;
        session_date?: string | null;
        session_time?: string | null;
        store_id?: string | null;
        player_leader_id?: string | null;
      } = {
        session_type: sessionType,
        name: name.trim(),
        game_id: gameId,
        player_leader_id: leader?.id ?? null,
      };
      if (sessionType === "competitive") {
        payload.session_date = date;
        payload.session_time = time;
        payload.store_id = selectedStore!.id;
      } else {
        if (date) payload.session_date = date;
      }
      const res = await createSession({ data: payload });
      const created = res.session as CreatedSession;
      toast.success(
        created.status === "matched"
          ? "Partida vinculada al torneo. Registra tus rondas y rivales."
          : "Partida creada",
      );
      onCreated(created);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la partida");
    } finally {
      setSubmitting(false);
    }
  };

  const isCompetitive = sessionType === "competitive";
  const storeQueryTrimmed = storeQuery.trim();

  const storeField = (
    <div className="relative">
      <label htmlFor="session-store" className={LABEL}>
        Tienda
      </label>
      {selectedStore ? (
        <div className="mt-1.5 flex min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-secondary pl-3 text-sm">
          <div className="min-w-0 py-2">
            <div className="truncate font-medium text-foreground">{selectedStore.name}</div>
            {selectedStore.city && (
              <div className="text-xs text-foreground-secondary">{selectedStore.city}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedStore(null);
              setStoreQuery("");
            }}
            className={`inline-flex min-h-11 flex-shrink-0 items-center rounded-md px-3 text-sm text-foreground-secondary transition hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <div className="relative mt-1.5">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
            />
            <input
              id="session-store"
              type="text"
              autoComplete="off"
              value={storeQuery}
              onChange={(e) => {
                setStoreQuery(e.target.value);
                setStoreDropdownOpen(true);
              }}
              onFocus={() => setStoreDropdownOpen(true)}
              placeholder="Nombre o ciudad de la tienda"
              aria-expanded={storeDropdownOpen && !!storeQueryTrimmed}
              aria-controls="session-store-results"
              className={`${INPUT} pl-9`}
            />
            {storeSearching && (
              <Loader2
                size={16}
                aria-hidden="true"
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-foreground-subtle"
              />
            )}
          </div>
          {storeDropdownOpen && storeQueryTrimmed && !storeSearching && (
            <div
              id="session-store-results"
              className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-2xl"
            >
              {storeFailed ? (
                <div className="p-3">
                  <InlineError onRetry={() => setStoreRetry((k) => k + 1)}>
                    No pudimos buscar tiendas.
                  </InlineError>
                </div>
              ) : storeResults.length === 0 ? (
                <p className="p-3 text-sm text-foreground-secondary">
                  Sin tiendas para “{storeQueryTrimmed}”.
                </p>
              ) : (
                storeResults.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => {
                      setSelectedStore(s);
                      setStoreDropdownOpen(false);
                      setStoreQuery("");
                    }}
                    className="flex min-h-11 w-full flex-col items-start justify-center px-3 py-2 text-left text-sm text-foreground transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.city && <span className="text-xs text-foreground-subtle">{s.city}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  const nameField = (
    <div>
      <label htmlFor="session-name" className={LABEL}>
        Nombre
      </label>
      <input
        id="session-name"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameTouched(true);
        }}
        placeholder={
          isCompetitive ? "Se llena con la tienda y la fecha" : "Ej. Práctica del miércoles"
        }
        maxLength={100}
        className={`${INPUT} mt-1.5`}
      />
    </div>
  );

  // Con un solo TCG no hay nada que elegir: se asigna solo y no se muestra (no repetir el juego).
  const gameField = gamesFailed ? (
    <InlineError onRetry={() => setGamesRetry((k) => k + 1)}>
      No pudimos cargar tus TCG.
    </InlineError>
  ) : gamesLoading && games.length === 0 ? (
    <p role="status" className="text-sm text-foreground-subtle">
      Cargando TCG…
    </p>
  ) : !gamesLoading && games.length === 0 ? (
    <p className="text-sm text-foreground-secondary">No hay TCG disponibles.</p>
  ) : games.length > 1 ? (
    <div>
      <span className={LABEL}>TCG</span>
      <div className="mt-1.5">
        <ChipGroup
          label="TCG"
          options={games.map((g) => ({ key: g.id, label: g.name }))}
          value={gameId}
          onChange={(key) => {
            if (!key) return;
            setGameId(key);
            setLeader(null);
          }}
        />
      </div>
    </div>
  ) : null;

  const leaderField = (
    <div>
      <span className={LABEL}>
        Tu leader <span className="font-normal text-foreground-subtle">(opcional)</span>
      </span>
      <div className="mt-1.5">
        <LeaderSelect gameId={gameId} value={leader} onChange={setLeader} />
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70"
          />

          {/* Hoja inferior en móvil, diálogo centrado en escritorio */}
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              key="sheet"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-session-title"
              tabIndex={-1}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="pointer-events-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-popover shadow-2xl outline-none sm:max-h-[85dvh] sm:rounded-2xl"
            >
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border py-2 pl-5 pr-2">
                <h2 id="create-session-title" className="text-lg font-semibold text-foreground">
                  {step === 1
                    ? "Nueva partida"
                    : isCompetitive
                      ? "Torneo oficial"
                      : "Partida casual"}
                </h2>
                <div className="flex items-center">
                  {step === 2 && !prefill && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm text-foreground-secondary transition hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
                    >
                      Cambiar tipo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className={`flex h-11 w-11 items-center justify-center rounded-md text-foreground-secondary transition hover:bg-white/5 hover:text-foreground ${FOCUS_RING}`}
                    aria-label="Cerrar"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {step === 1 && (
                <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  <p className="text-sm text-foreground-secondary">¿Qué vas a registrar?</p>
                  <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                    {(
                      [
                        {
                          type: "competitive",
                          title: "Torneo oficial",
                          body: "Cuenta para tu ranking. Se vincula sola cuando la tienda suba los resultados.",
                        },
                        {
                          type: "casual",
                          title: "Partida casual",
                          body: "Prácticas o partidas fuera de torneo. No cuentan para tu ranking.",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => {
                          setSessionType(opt.type);
                          setStep(2);
                        }}
                        className={`flex w-full items-center gap-3 p-4 text-left transition first:rounded-t-xl last:rounded-b-xl hover:bg-white/5 ${FOCUS_RING}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold text-foreground">
                            {opt.title}
                          </span>
                          <span className="mt-0.5 block text-sm text-foreground-secondary">
                            {opt.body}
                          </span>
                        </span>
                        <ChevronRight
                          size={16}
                          aria-hidden="true"
                          className="flex-shrink-0 text-foreground-subtle"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && sessionType && (
                <>
                  <div className="flex-1 space-y-5 overflow-y-auto p-5">
                    {isCompetitive ? (
                      <>
                        {storeField}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="session-date" className={LABEL}>
                              Fecha
                            </label>
                            <input
                              id="session-date"
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className={`${INPUT} mt-1.5`}
                            />
                          </div>
                          <div>
                            <label htmlFor="session-time" className={LABEL}>
                              Hora de inicio
                            </label>
                            <input
                              id="session-time"
                              type="time"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                              className={`${INPUT} mt-1.5`}
                            />
                          </div>
                        </div>
                        <p className="-mt-2 text-sm text-foreground-subtle">
                          Con la tienda, fecha y hora correctas tu partida se vincula sola al
                          torneo. Si no coinciden, la vinculas a mano después.
                        </p>
                        {nameField}
                        {gameField}
                        {leaderField}
                      </>
                    ) : (
                      <>
                        {nameField}
                        {gameField}
                        <div>
                          <label htmlFor="session-date" className={LABEL}>
                            Fecha{" "}
                            <span className="font-normal text-foreground-subtle">(opcional)</span>
                          </label>
                          <input
                            id="session-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={`${INPUT} mt-1.5`}
                          />
                        </div>
                        {leaderField}
                      </>
                    )}
                  </div>

                  <div className="flex-shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting}
                      aria-describedby={missing.length > 0 ? "create-session-missing" : undefined}
                      className={`${BTN_PRIMARY} w-full`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} aria-hidden="true" className="animate-spin" />
                          Creando…
                        </>
                      ) : (
                        "Crear partida"
                      )}
                    </button>
                    {missing.length > 0 && (
                      <p
                        id="create-session-missing"
                        className="mt-2 text-center text-xs text-foreground-subtle"
                      >
                        Falta: {missing.join(", ")}
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
