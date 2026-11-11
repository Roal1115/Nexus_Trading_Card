import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ShieldQuestion,
  X,
  Search,
  Loader2,
  Images,
} from "lucide-react";
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
  ChipGroup,
  FOCUS_RING,
  InlineError,
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

const INPUT =
  "min-h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";
const LABEL = "text-sm font-medium text-foreground-secondary";
const BTN_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 ${FOCUS_RING}`;

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
        onCreated={(id) => {
          setShowCreateSheet(false);
          setPrefill(null);
          queryClient.invalidateQueries({ queryKey: slotsKey });
          navigate({ to: "/sessions/$sessionId", params: { sessionId: id } });
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
  const [variants, setVariants] = useState<DeckIdentifier[]>([]);

  useEffect(() => {
    if (!open || !value.card_set_id) return;
    fetchLeaders({ data: { game_id: gameId, card_set_id: value.card_set_id } })
      .then((rows) => setVariants(rows as DeckIdentifier[]))
      .catch(() => setVariants([]));
  }, [open, value.card_set_id, gameId, fetchLeaders]);

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
              {variants.length === 0 ? (
                <p className="text-xs text-foreground-subtle">Buscando artes…</p>
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
  const [options, setOptions] = useState<DeckIdentifier[]>([]);

  useEffect(() => {
    if (!open || !gameId) return;
    const t = setTimeout(() => {
      fetchLeaders({
        data: { game_id: gameId, search: search || undefined, basic_only: true },
      })
        .then((rows) => setOptions(rows as DeckIdentifier[]))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, search, gameId, fetchLeaders]);

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
        <div className="animate-in fade-in-0 zoom-in-95 duration-150 absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-2xl">
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
            {options.length === 0 ? (
              <p className="px-3 py-3 text-sm text-foreground-subtle">Sin resultados.</p>
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
      {!value && (
        <div className="mt-2 flex h-20 w-14 items-center justify-center rounded-md border border-border bg-muted">
          <ShieldQuestion size={18} aria-hidden="true" className="text-foreground-subtle" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// CreateSessionSheet
// ============================================================
type Game = { id: string; name: string; slug: string };
type StoreRow = { id: string; name: string; city: string | null; zone: string | null };

function CreateSessionSheet({
  open,
  prefill,
  onClose,
  onCreated,
}: {
  open: boolean;
  prefill: SlotToLog | null;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const fetchGames = useServerFn(getMySessionGames);
  const searchStoresFn = useServerFn(searchStores);
  const createSession = useServerFn(createStandaloneSession);

  const [step, setStep] = useState<1 | 2>(1);
  const [sessionType, setSessionType] = useState<"competitive" | "casual" | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  const [name, setName] = useState("");
  const [gameId, setGameId] = useState<string | null>(null);
  const [leader, setLeader] = useState<DeckIdentifier | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [storeResults, setStoreResults] = useState<StoreRow[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [storeSearching, setStoreSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1);
        setSessionType(null);
        setName("");
        setGameId(null);
        setLeader(null);
        setDate("");
        setTime("");
        setStoreQuery("");
        setStoreResults([]);
        setSelectedStore(null);
        setStoreDropdownOpen(false);
        setSubmitting(false);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !prefill) return;
    const weekday = new Date(`${prefill.date}T12:00:00`).toLocaleDateString("es-MX", {
      weekday: "long",
    });
    setSessionType("competitive");
    setStep(2);
    setName(`Torneo del ${weekday} — ${prefill.store_name}`.slice(0, 100));
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

  // Load games when opening
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGamesLoading(true);
    (async () => {
      try {
        const res = await fetchGames();
        if (cancelled) return;
        const list = (res.games ?? []) as Game[];
        setGames(list);
        setGameId((prev) => prev ?? list[0]?.id ?? null);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? "No se pudo cargar los TCG");
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fetchGames]);

  // Store search debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!storeQuery.trim() || sessionType !== "competitive") {
      setStoreResults([]);
      return;
    }
    setStoreSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await searchStoresFn({ data: { search: storeQuery.trim() } });
        setStoreResults(res.stores);
      } catch {
        setStoreResults([]);
      } finally {
        setStoreSearching(false);
      }
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [storeQuery, sessionType, searchStoresFn]);

  const canSubmit = useMemo(() => {
    if (!sessionType || !name.trim() || !gameId) return false;
    if (sessionType === "competitive") {
      if (!date || !time || !selectedStore) return false;
    }
    return true;
  }, [sessionType, name, gameId, date, time, selectedStore]);

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
      toast.success("Partida creada");
      onCreated((res.session as { id: string }).id);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la partida");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70"
          />

          {/* Container: bottom-sheet on mobile, centered modal on desktop */}
          <div className="fixed inset-0 z-50 flex items-end justify-center pb-[calc(4rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4 pointer-events-none">
            <motion.div
              initial={{ y: "100%", opacity: 1, scale: 1 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 1 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="pointer-events-auto w-full max-w-lg rounded-t-2xl border border-border bg-popover shadow-2xl sm:rounded-2xl"
              style={{ maxHeight: "85vh" }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-base font-semibold text-foreground">
                  {step === 1 ? "Nueva partida" : "Detalles de la partida"}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex h-11 w-11 items-center justify-center rounded-md text-foreground-secondary transition hover:bg-white/5 hover:text-foreground ${FOCUS_RING}`}
                  aria-label="Cerrar"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: "calc(85vh - 60px)" }}>
                {step === 1 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSessionType("competitive");
                        setStep(2);
                      }}
                      className={`flex flex-col items-start gap-1 rounded-xl border border-border p-4 text-left transition hover:bg-white/5 ${FOCUS_RING}`}
                    >
                      <span className="text-base font-semibold text-foreground">
                        Torneo oficial
                      </span>
                      <span className="text-sm text-foreground-secondary">
                        Registra un torneo oficial. Se vinculará automáticamente cuando el
                        organizador suba los resultados.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSessionType("casual");
                        setStep(2);
                      }}
                      className={`flex flex-col items-start gap-1 rounded-xl border border-border p-4 text-left transition hover:bg-white/5 ${FOCUS_RING}`}
                    >
                      <span className="text-base font-semibold text-foreground">
                        Partida casual
                      </span>
                      <span className="text-sm text-foreground-secondary">
                        Prácticas o partidas fuera de un torneo oficial. No cuentan para tu ranking.
                      </span>
                    </button>
                  </div>
                )}

                {step === 2 && sessionType && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-foreground-secondary transition hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
                    >
                      {sessionType === "competitive" ? "Torneo oficial" : "Partida casual"}
                      <span className="text-foreground-subtle">· Cambiar</span>
                    </button>

                    {/* Nombre */}
                    <div>
                      <label htmlFor="session-name" className={LABEL}>
                        Nombre *
                      </label>
                      <input
                        id="session-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Torneo lunes, Práctica miércoles"
                        maxLength={100}
                        className={`${INPUT} mt-1.5`}
                      />
                    </div>

                    {/* TCG */}
                    <div>
                      <span className={LABEL}>TCG *</span>
                      {gamesLoading ? (
                        <div className="mt-1.5 text-sm text-foreground-subtle">Cargando…</div>
                      ) : games.length === 0 ? (
                        <div className="mt-1.5 text-sm text-foreground-subtle">
                          No hay TCGs disponibles.
                        </div>
                      ) : (
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
                      )}
                    </div>

                    {/* Leader / deck propio */}
                    <div>
                      <span className={LABEL}>Tu leader / deck (opcional)</span>
                      <div className="mt-1.5">
                        <LeaderSelect gameId={gameId} value={leader} onChange={setLeader} />
                      </div>
                    </div>

                    {/* Fecha */}
                    <div>
                      <label htmlFor="session-date" className={LABEL}>
                        {sessionType === "competitive" ? "Fecha del torneo *" : "Fecha (opcional)"}
                      </label>
                      <input
                        id="session-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={`${INPUT} mt-1.5`}
                      />
                    </div>

                    {sessionType === "competitive" && (
                      <>
                        {/* Hora */}
                        <div>
                          <label htmlFor="session-time" className={LABEL}>
                            Hora de inicio *
                          </label>
                          <input
                            id="session-time"
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className={`${INPUT} mt-1.5`}
                          />
                        </div>

                        {/* Tienda */}
                        <div className="relative">
                          <label htmlFor="session-store" className={LABEL}>
                            Tienda *
                          </label>
                          {selectedStore ? (
                            <div className="mt-1.5 flex items-center justify-between rounded-md border border-primary/40 bg-primary/15 px-3 py-2 text-sm">
                              <div>
                                <div className="font-medium text-foreground">
                                  {selectedStore.name}
                                </div>
                                {selectedStore.city && (
                                  <div className="text-xs text-foreground-secondary">
                                    {selectedStore.city}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStore(null);
                                  setStoreQuery("");
                                }}
                                className={`flex h-11 w-11 items-center justify-center rounded-md text-foreground-secondary transition hover:text-foreground sm:h-9 sm:w-9 ${FOCUS_RING}`}
                                aria-label="Quitar tienda"
                              >
                                <X size={16} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="relative mt-1.5">
                                <Search
                                  size={16}
                                  aria-hidden="true"
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
                                />
                                <input
                                  id="session-store"
                                  type="text"
                                  value={storeQuery}
                                  onChange={(e) => {
                                    setStoreQuery(e.target.value);
                                    setStoreDropdownOpen(true);
                                  }}
                                  onFocus={() => setStoreDropdownOpen(true)}
                                  placeholder="Buscar tienda…"
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
                              {storeDropdownOpen && storeResults.length > 0 && (
                                <div className="animate-in fade-in-0 zoom-in-95 duration-150 absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-2xl">
                                  {storeResults.map((s) => (
                                    <button
                                      type="button"
                                      key={s.id}
                                      onClick={() => {
                                        setSelectedStore(s);
                                        setStoreDropdownOpen(false);
                                        setStoreQuery("");
                                      }}
                                      className="flex min-h-11 w-full flex-col items-start justify-center px-3 py-2 text-left text-sm text-foreground transition hover:bg-white/5"
                                    >
                                      <span className="font-medium">{s.name}</span>
                                      {s.city && (
                                        <span className="text-xs text-foreground-subtle">
                                          {s.city}
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <p className="text-sm text-warning">
                          Si ingresas datos incorrectos de fecha, hora o tienda, tendrás que
                          vincular manualmente tu partida al torneo correcto después.
                        </p>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting}
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
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
