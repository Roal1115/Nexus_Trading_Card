import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Trophy,
  Swords,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ChevronRight,
  ChevronDown,
  ShieldQuestion,
  X,
  Search,
  Loader2,
} from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getStandaloneSessions,
  deleteStandaloneSession,
  createStandaloneSession,
  searchStores,
} from "@/lib/geekarena-standalone.functions";
import { getMyStatsGames } from "@/lib/geekarena-player.functions";
import { getDeckIdentifiers } from "@/lib/geekarena-tournament-tracker.functions";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";

type DeckIdentifier = {
  id: string;
  base_name: string;
  card_image: string | null;
  card_set_id: string | null;
};

function cleanName(name: string): string {
  return name.replace(/\s*-\s*[A-Z]{1,4}\d{1,3}-\d{1,3}\s*$/g, "").trim();
}

export const Route = createFileRoute("/sessions/")({
  head: () => ({ meta: [{ title: "Mis Sesiones — Geek Arena" }] }),
  component: SessionsPage,
});

type SessionsResult = Awaited<ReturnType<typeof getStandaloneSessions>>;
type SessionRow = SessionsResult["sessions"][number];

function formatSessionDate(date: string | null): string {
  if (!date) return "Sin fecha";
  try {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Sin fecha";
  }
}

function StatusBadge({ status }: { status: SessionRow["status"] }) {
  if (status === "unlinked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Pendiente
      </span>
    );
  }
  if (status === "matched") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
        <CheckCircle2 size={12} />
        Vinculada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-gray-400">
      <Swords size={12} />
      Casual
    </span>
  );
}

function SessionCard({
  session,
  onDelete,
  isDeleting,
}: {
  session: SessionRow;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const goToDetail = () => {
    if (confirming) return;
    navigate({ to: "/sessions/$sessionId", params: { sessionId: session.id } });
  };

  return (
    <div
      onClick={goToDetail}
      className="glass group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-white/10 p-4 transition hover:border-primary/40 hover:bg-white/[0.04]"
    >
      <div className="flex-shrink-0">
        {session.session_type === "competitive" ? (
          <Trophy size={16} className="text-primary" />
        ) : (
          <Swords size={16} className="text-gray-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={session.status} />
          <span className="truncate text-sm font-semibold text-white">{session.name}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-gray-500">{session.game_name}</div>
      </div>

      <div className="hidden sm:block text-right min-w-0">
        <div className="text-xs text-gray-300">{formatSessionDate(session.session_date)}</div>
        <div className="mt-0.5 text-[11px] text-gray-500 truncate">
          {session.store_name ?? "Sin tienda"}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {session.status !== "matched" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition"
            aria-label="Eliminar sesión"
          >
            <Trash2 size={14} />
          </button>
        )}
        <ChevronRight size={16} className="text-gray-600 group-hover:text-primary transition" />
      </div>

      {/* Delete confirmation — full-row overlay, same format used on the round rows */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-10 flex items-center justify-between gap-3 rounded-2xl bg-red-950/95 px-4 backdrop-blur-sm"
          >
            <span className="truncate text-sm font-medium text-red-100">
              ¿Eliminar "{session.name}"?
            </span>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  onDelete(session.id);
                  setConfirming(false);
                }}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? "…" : "Eliminar"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SessionsPage() {
  const { player, loading: roleLoading } = useGeekarenaRole();
  const fetchSessions = useServerFn(getStandaloneSessions);
  const removeSession = useServerFn(deleteStandaloneSession);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const navigate = useNavigate();


  useEffect(() => {
    if (roleLoading) return;
    if (!player) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchSessions();
        if (!cancelled) setSessions(res.sessions);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? "Error al cargar sesiones");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, roleLoading, fetchSessions]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeSession({ data: { session_id: id } });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Sesión eliminada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar la sesión");
    } finally {
      setDeletingId(null);
    }
  };

  if (!roleLoading && !player) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="glass rounded-2xl border border-white/10 p-8 text-center">
          <h1 className="text-xl font-bold text-white">Debes iniciar sesión</h1>
          <p className="mt-2 text-sm text-gray-400">
            Inicia sesión para ver y crear tus sesiones.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
          >
            Iniciar Sesión
          </Link>
        </div>
      </main>
    );
  }

  const unlinkedCount = sessions.filter((s) => s.status === "unlinked").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-6 sm:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-500">
            <Layers size={14} />
            Performance
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">Mis Sesiones</h1>
        </div>

        {/* Create button (desktop) */}
        <button
          onClick={() => setShowCreateSheet(true)}
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110"
        >
          <Plus size={14} />
          Nueva Sesión
        </button>
      </div>

      {/* Amber banner */}
      {unlinkedCount > 0 && !loading && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            Tienes {unlinkedCount}{" "}
            {unlinkedCount === 1
              ? "sesión pendiente de vinculación"
              : "sesiones pendientes de vinculación"}
            .
          </span>
        </div>
      )}

      {/* Content */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <>
            <SkeletonBlock className="h-20 w-full" />
            <SkeletonBlock className="h-20 w-full" />
            <SkeletonBlock className="h-20 w-full" />
          </>
        ) : sessions.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-2xl border border-white/10 px-6 py-14 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Layers size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Sin sesiones registradas</h2>
            <p className="mt-1 max-w-sm text-sm text-gray-400">
              Crea tu primera sesión para empezar a registrar tus partidas.
            </p>
            <button
              onClick={() => setShowCreateSheet(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110"
            >
              <Plus size={14} />
              Nueva Sesión
            </button>
          </div>
        ) : (
          sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onDelete={handleDelete}
              isDeleting={deletingId === s.id}
            />
          ))
        )}
      </div>

      {/* Create button (mobile sticky) */}
      <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center px-4 sm:hidden">
        <button
          onClick={() => setShowCreateSheet(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110"
        >
          <Plus size={16} />
          Nueva Sesión
        </button>
      </div>

      <CreateSessionSheet
        open={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onCreated={(id) => {
          setShowCreateSheet(false);
          navigate({ to: "/sessions/$sessionId", params: { sessionId: id } });
        }}
      />
    </main>
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
        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        <span className="truncate">
          {value ? (
            cleanName(value.base_name)
          ) : (
            <span className="text-gray-500">Selecciona tu leader…</span>
          )}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-gray-500" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-white/10 bg-[#0f1117] shadow-xl">
          <div className="relative p-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leader…"
              className="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-500">Sin resultados.</p>
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
                  className="flex w-full items-center gap-2 bg-transparent px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/10"
                >
                  <span className="flex-shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {opt.card_set_id}
                  </span>
                  <span className="flex-1 truncate">{cleanName(opt.base_name)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {value?.card_image && (
        <div className="mt-2">
          <img
            src={value.card_image}
            alt={value.base_name}
            className="h-20 max-w-full rounded-md border border-white/10 object-contain"
          />
        </div>
      )}
      {!value && (
        <div className="mt-2 flex h-20 w-14 items-center justify-center rounded-md border border-white/10 bg-black/30">
          <ShieldQuestion size={18} className="text-gray-600" />
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
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const fetchGames = useServerFn(getMyStatsGames);
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
      toast.success("Sesión creada");
      onCreated((res.session as { id: string }).id);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la sesión");
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
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Container: bottom-sheet on mobile, centered modal on desktop */}
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 pointer-events-none">
            <motion.div
              initial={{ y: "100%", opacity: 1, scale: 1 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 1 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="pointer-events-auto glass w-full max-w-lg rounded-t-2xl border border-white/10 bg-black/90 shadow-2xl sm:rounded-2xl"
              style={{ maxHeight: "85vh" }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="text-base font-bold text-white">
                  {step === 1 ? "Nueva Sesión" : "Detalles de la sesión"}
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-gray-500 hover:bg-white/5 hover:text-white transition"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div
                className="overflow-y-auto px-5 py-5"
                style={{ maxHeight: "calc(85vh - 60px)" }}
              >
                {step === 1 && (
                  <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-2">
                    <button
                      onClick={() => {
                        setSessionType("competitive");
                        setStep(2);
                      }}
                      className="glass flex flex-col items-start gap-3 rounded-2xl border border-white/10 p-5 text-left transition hover:border-primary/40 hover:bg-white/[0.03]"
                    >
                      <Trophy size={32} className="text-primary" />
                      <h3 className="text-lg font-bold text-white">Torneo Competitivo</h3>
                      <p className="text-xs text-gray-400">
                        Registra un torneo oficial. Se vinculará automáticamente cuando el
                        organizador suba los resultados.
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setSessionType("casual");
                        setStep(2);
                      }}
                      className="glass flex flex-col items-start gap-3 rounded-2xl border border-white/10 p-5 text-left transition hover:border-white/20 hover:bg-white/[0.03]"
                    >
                      <Swords size={32} className="text-gray-400" />
                      <h3 className="text-lg font-bold text-white">Partidas Casuales</h3>
                      <p className="text-xs text-gray-400">
                        Prácticas o partidas fuera de un torneo oficial. No afectan tu ranking
                        competitivo.
                      </p>
                    </button>
                  </div>
                )}

                {step === 2 && sessionType && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
                    >
                      {sessionType === "competitive" ? (
                        <Trophy size={12} className="text-primary" />
                      ) : (
                        <Swords size={12} />
                      )}
                      {sessionType === "competitive" ? "Torneo Competitivo" : "Partidas Casuales"}
                      <span className="text-gray-600">· Cambiar</span>
                    </button>

                    {/* Nombre */}
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-gray-500">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Torneo Lunes, Práctica Miércoles"
                        maxLength={100}
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* TCG */}
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-gray-500">
                        TCG *
                      </label>
                      {gamesLoading ? (
                        <div className="mt-1.5 text-xs text-gray-500">Cargando…</div>
                      ) : games.length === 0 ? (
                        <div className="mt-1.5 text-xs text-gray-500">
                          Aún no juegas ningún TCG registrado. Participa en un torneo primero.
                        </div>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {games.map((g) => {
                            const active = gameId === g.id;
                            return (
                              <button
                                key={g.id}
                                onClick={() => {
                                  setGameId(g.id);
                                  setLeader(null);
                                }}
                                className={
                                  active
                                    ? "rounded-full border border-primary bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition"
                                    : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:border-white/20 hover:text-white transition"
                                }
                              >
                                {g.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Leader / deck propio */}
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-gray-500">
                        Tu leader / deck (opcional)
                      </label>
                      <div className="mt-1.5">
                        <LeaderSelect gameId={gameId} value={leader} onChange={setLeader} />
                      </div>
                    </div>

                    {/* Fecha */}
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-gray-500">
                        {sessionType === "competitive"
                          ? "Fecha del torneo *"
                          : "Fecha (opcional)"}
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                      />
                    </div>

                    {sessionType === "competitive" && (
                      <>
                        {/* Hora */}
                        <div>
                          <label className="text-[11px] uppercase tracking-wider text-gray-500">
                            Hora de inicio *
                          </label>
                          <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                          />
                        </div>

                        {/* Tienda */}
                        <div className="relative">
                          <label className="text-[11px] uppercase tracking-wider text-gray-500">
                            Tienda *
                          </label>
                          {selectedStore ? (
                            <div className="mt-1.5 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                              <div>
                                <div className="text-white font-medium">{selectedStore.name}</div>
                                {selectedStore.city && (
                                  <div className="text-[11px] text-gray-400">
                                    {selectedStore.city}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedStore(null);
                                  setStoreQuery("");
                                }}
                                className="rounded-md p-1 text-gray-400 hover:text-white transition"
                                aria-label="Quitar tienda"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="relative mt-1.5">
                                <Search
                                  size={14}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                                />
                                <input
                                  type="text"
                                  value={storeQuery}
                                  onChange={(e) => {
                                    setStoreQuery(e.target.value);
                                    setStoreDropdownOpen(true);
                                  }}
                                  onFocus={() => setStoreDropdownOpen(true)}
                                  placeholder="Buscar tienda…"
                                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:border-primary/50"
                                />
                                {storeSearching && (
                                  <Loader2
                                    size={14}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500"
                                  />
                                )}
                              </div>
                              {storeDropdownOpen && storeResults.length > 0 && (
                                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-black/95 shadow-xl">
                                  {storeResults.map((s) => (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        setSelectedStore(s);
                                        setStoreDropdownOpen(false);
                                        setStoreQuery("");
                                      }}
                                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-white hover:bg-white/5 transition"
                                    >
                                      <span className="font-medium">{s.name}</span>
                                      {s.city && (
                                        <span className="text-[11px] text-gray-500">
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

                        <p className="text-[11px] text-amber-400/80">
                          ⚠ Si ingresas datos incorrectos de fecha, hora o tienda, tendrás que
                          vincular manualmente la sesión al torneo correcto después.
                        </p>
                      </>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Creando…
                        </>
                      ) : (
                        "Crear Sesión"
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

