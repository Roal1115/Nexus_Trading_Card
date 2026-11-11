import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trophy,
  Swords,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Link2Off,
  ShieldQuestion,
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  Pencil,
  Check,
  CalendarDays,
  Images,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  getStandaloneSessionDetail,
  undoSessionLink,
  deleteStandaloneSession,
  getTournamentCandidates,
  linkSessionManually,
  saveStandaloneRound,
  deleteStandaloneRound,
  updateStandaloneSessionDetails,
} from "@/lib/nexus-standalone.functions";
import { getDeckIdentifiers } from "@/lib/nexus-tournament-tracker.functions";
import {
  cleanLeaderName,
  LeaderSearchSelect,
  RoundCardFrame,
  RoundFieldLabel,
  RoundNotesField,
  RoundOutcomeFields,
  RoundSaveButton,
  type DeckIdentifier,
} from "@/components/tournament-tracker/round-ui";
import { InlineError } from "@/components/stores/store-ui";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import { AnimatePresence, motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/sessions/$sessionId")({
  head: () => ({ meta: [{ title: "Partida — Nexus" }] }),
  component: SessionDetailPage,
});

// ============================================================
// Types
// ============================================================
type SessionDetail = Awaited<ReturnType<typeof getStandaloneSessionDetail>>;
type SessionData = SessionDetail["session"];
type RoundData = SessionDetail["rounds"][number];

// Rename/delete/link state & handlers, owned by SessionDetailPage and rendered
// inside the merged hero card so both live in the same section.
type SessionHeaderProps = {
  editingDetails: boolean;
  setEditingDetails: (v: boolean) => void;
  nameDraft: string;
  setNameDraft: (v: string) => void;
  dateDraft: string;
  setDateDraft: (v: string) => void;
  savingDetails: boolean;
  onSaveDetails: () => void;
  deleteConfirming: boolean;
  setDeleteConfirming: (v: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
  undoConfirming: boolean;
  setUndoConfirming: (v: boolean) => void;
  undoing: boolean;
  onUndo: () => void;
  onLinkManually: () => void;
};

type Candidate = {
  id: string;
  tournament_date: string;
  tournament_time: string | null;
  store_id: string;
  store_name: string;
  store_city: string;
  store_zone: string | null;
  diff_hours: number;
  is_home_zone: boolean;
};

// ============================================================
// Helpers
// ============================================================
function formatDate(date: string | null): string {
  if (!date) return "Sin fecha";
  try {
    return new Date(date + "T00:00:00").toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function formatTime(time: string | null): string {
  if (!time) return "Sin hora";
  try {
    const [h, m] = time.split(":");
    const d = new Date();
    d.setHours(Number(h), Number(m));
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return time;
  }
}

function ResultDot({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null;
  const color = payload.result === "win" ? "var(--success)" : "var(--danger)";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--card)" strokeWidth={1.5} />;
}

function WinRateTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-white/10 bg-[#0f1117] px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-semibold text-white">Ronda {p.round}</p>
      <p className={p.result === "win" ? "text-emerald-400" : "text-red-400"}>
        {p.result === "win" ? "Victoria" : "Derrota"} · {p.rate}% acum.
      </p>
    </div>
  );
}

// ============================================================
// StatusBadge
// ============================================================
function StatusBadge({ status }: { status: string }) {
  if (status === "unlinked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Pendiente
      </span>
    );
  }
  if (status === "matched") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
        <CheckCircle2 size={12} />
        Vinculada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-gray-400">
      <Swords size={12} />
      Casual
    </span>
  );
}

// ============================================================
// LeaderSelect — reutiliza patrón de PerformanceTrackerModal
// ============================================================
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
          className="h-20 max-w-full rounded-md border border-white/10 object-contain"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Cambiar arte"
          className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-white backdrop-blur-sm transition hover:bg-black/90"
        >
          <Images size={11} />
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
                <p className="text-xs text-gray-500">Buscando artes…</p>
              ) : (
                variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onChange(v);
                      setOpen(false);
                    }}
                    className={`flex-shrink-0 overflow-hidden rounded-md border transition ${
                      v.id === value.id
                        ? "border-primary ring-1 ring-primary"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {v.card_image ? (
                      <img
                        src={v.card_image}
                        alt={v.card_name}
                        className="h-16 w-11 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-11 items-center justify-center bg-black/30 text-xs text-gray-600">
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
// StandaloneRoundCard
// ============================================================
type RoundState = {
  id?: string;
  round_number: number;
  is_bye: boolean;
  player_leader: DeckIdentifier | null;
  player_leader_id: string | null;
  opponent_leader: DeckIdentifier | null;
  opponent_leader_id: string | null;
  opponent_player_id: string | null;
  won_die_roll: boolean | null;
  turn_order: "first" | "second" | null;
  won_match: boolean | null;
  notes: string | null;
};

function StandaloneRoundCard({
  round,
  gameId,
  onChange,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  round: RoundState;
  gameId: string;
  onChange: (patch: Partial<RoundState>) => void;
  onSave: () => Promise<boolean>;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const setLeader = (d: DeckIdentifier | null) =>
    onChange({ opponent_leader: d, opponent_leader_id: d?.id ?? null });

  return (
    <RoundCardFrame
      round={round}
      opponentLabel={round.opponent_leader ? cleanLeaderName(round.opponent_leader.base_name) : "—"}
      onDelete={onDelete}
      deleting={deleting}
    >
      {(close) => (
        <>
          <div>
            <RoundFieldLabel>Leader del oponente (obligatorio)</RoundFieldLabel>
            <LeaderSearchSelect
              gameId={gameId}
              value={round.opponent_leader}
              onChange={setLeader}
              placeholder="Selecciona leader oponente…"
            />
            {round.opponent_leader?.card_image && (
              <LeaderArtSwitcher
                gameId={gameId}
                value={round.opponent_leader}
                onChange={setLeader}
              />
            )}
          </div>
          <RoundOutcomeFields round={round} onChange={onChange} />
          <RoundNotesField value={round.notes} onChange={(notes) => onChange({ notes })} />
          <RoundSaveButton
            saving={saving}
            onClick={async () => {
              if (await onSave()) close();
            }}
          />
        </>
      )}
    </RoundCardFrame>
  );
}

// ============================================================
// HeroLeaderPicker — tap the image to open a full-screen (mobile) /
// centered (desktop) sheet: search any leader, or pick another art of
// the same card when the search box is empty. One flow for both.
// ============================================================
function HeroLeaderPicker({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: DeckIdentifier | null;
  onChange: (d: DeckIdentifier) => void;
}) {
  const fetchLeaders = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"art" | "search">(value ? "art" : "search");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DeckIdentifier[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const trimmed = mode === "search" ? search.trim() : "";
    const t = setTimeout(() => {
      const query = trimmed
        ? { game_id: gameId, search: trimmed, basic_only: true }
        : mode === "art" && value?.card_set_id
          ? { game_id: gameId, card_set_id: value.card_set_id }
          : { game_id: gameId, basic_only: true };
      fetchLeaders({ data: query })
        .then((rows) => setResults(rows as DeckIdentifier[]))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [open, mode, search, gameId, value?.card_set_id, fetchLeaders]);

  const close = () => {
    setOpen(false);
    setMode("art");
    setSearch("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cambiar leader"
        className="relative block flex-shrink-0"
      >
        {value?.card_image ? (
          <img
            src={value.card_image}
            alt={value.base_name}
            className="h-24 w-16 rounded-xl border border-white/20 object-cover shadow-xl transition active:brightness-90"
          />
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-white/10 bg-black/40 transition active:border-primary/40">
            <ShieldQuestion size={20} className="text-gray-600" />
          </div>
        )}
        <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0b0d12] bg-primary text-primary-foreground shadow">
          <Pencil size={11} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={close}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="leader-picker-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl border border-border bg-popover shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[80vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-2">
                <h2 id="leader-picker-title" className="text-base font-semibold text-foreground">
                  Líder de la partida
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground-secondary transition hover:bg-secondary hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              {value && (
                <div className="flex-shrink-0 px-4 pt-4">
                  <div
                    role="tablist"
                    aria-label="Qué quieres cambiar"
                    className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1"
                  >
                    {(["art", "search"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={mode === tab}
                        onClick={() => setMode(tab)}
                        className={`min-h-10 rounded-md px-3 text-sm font-medium transition ${
                          mode === tab
                            ? "bg-card text-foreground"
                            : "text-foreground-secondary hover:text-foreground"
                        }`}
                      >
                        {tab === "art" ? "Elegir arte" : "Otro líder"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {mode === "art" && value ? (
                  <>
                    <div className="flex items-center gap-4 border-b border-border pb-4">
                      {value.card_image ? (
                        <img
                          src={value.card_image}
                          alt={value.base_name}
                          className="h-32 w-[92px] flex-shrink-0 rounded-lg border border-primary object-cover"
                        />
                      ) : (
                        <div className="flex h-32 w-[92px] flex-shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                          <ShieldQuestion size={24} className="text-foreground-subtle" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-foreground">
                          {cleanLeaderName(value.base_name)}
                        </h3>
                        <p className="mt-1 font-mono text-xs text-foreground-secondary">
                          {value.card_image_id ?? value.card_set_id}
                        </p>
                        <p className="mt-2 text-xs text-foreground-subtle">Arte seleccionado</p>
                      </div>
                    </div>
                    <div className="mb-3 mt-4 flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">Versiones disponibles</h3>
                      {!searching && results.length > 0 && (
                        <span className="text-xs text-foreground-subtle">
                          {results.length} {results.length === 1 ? "versión" : "versiones"}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mb-4">
                    <label htmlFor="leader-search" className="mb-2 block text-sm font-medium text-foreground">
                      Buscar otro líder
                    </label>
                    <div className="relative">
                      <Search
                        size={18}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
                      />
                      <input
                        id="leader-search"
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Nombre o ID (ej. OP10-010)"
                        className="h-11 w-full rounded-lg border border-input bg-transparent pl-10 pr-3 text-base text-foreground outline-none placeholder:text-foreground-subtle focus:border-primary sm:h-9 sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                {searching ? (
                  <p className="py-10 text-center text-sm text-foreground-secondary" role="status">
                    {mode === "art" ? "Buscando versiones…" : "Buscando líderes…"}
                  </p>
                ) : results.length === 0 ? (
                  <p className="py-10 text-center text-sm text-foreground-secondary">
                    {mode === "art" ? "No hay otras versiones disponibles." : "Sin resultados."}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {results.map((opt) => {
                      const selected = opt.id === value?.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            onChange(opt);
                            close();
                          }}
                          className="group min-w-0 text-left"
                        >
                          <span
                            className={`relative block aspect-[5/7] overflow-hidden rounded-lg border bg-secondary transition ${
                              selected
                                ? "border-primary ring-1 ring-primary"
                                : "border-border group-hover:border-foreground-subtle"
                            }`}
                          >
                            {opt.card_image ? (
                              <img
                                src={opt.card_image}
                                alt={opt.base_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center">
                                <ShieldQuestion size={24} className="text-foreground-subtle" />
                              </span>
                            )}
                            {selected && (
                              <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check size={16} aria-label="Seleccionado" />
                              </span>
                            )}
                          </span>
                          <span className="mt-2 line-clamp-2 block text-xs font-medium leading-snug text-foreground">
                            {cleanLeaderName(opt.base_name)}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-xs text-foreground-subtle">
                            {opt.card_image_id ?? opt.card_set_id}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// StandaloneRoundTracker
// ============================================================
function StandaloneRoundTracker({
  sessionId,
  gameId,
  initialRounds,
  sessionStatus,
  session,
  header,
}: {
  sessionId: string;
  gameId: string;
  initialRounds: RoundData[];
  sessionStatus: string;
  session: any;
  header: SessionHeaderProps;
}) {
  const saveRound = useServerFn(saveStandaloneRound);
  const delRound = useServerFn(deleteStandaloneRound);
  const updateSessionDetails = useServerFn(updateStandaloneSessionDetails);

  const [rounds, setRounds] = useState<RoundState[]>(() =>
    initialRounds.map((r) => ({
      id: r.id,
      round_number: r.round_number,
      is_bye: r.is_bye,
      player_leader: (r.player_leader as DeckIdentifier | null) ?? null,
      player_leader_id: (r.player_leader as any)?.id ?? null,
      opponent_leader: (r.opponent_leader as DeckIdentifier | null) ?? null,
      opponent_leader_id: (r.opponent_leader as any)?.id ?? null,
      opponent_player_id: null,
      won_die_roll: r.won_die_roll,
      turn_order: r.turn_order,
      won_match: r.won_match,
      notes: r.notes,
    })),
  );

  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);

  const isLocked = sessionStatus === "matched";

  const wins = rounds.filter((r) => r.won_match === true).length;
  const losses = rounds.filter((r) => r.won_match === false).length;

  const chartData = useMemo(() => {
    const played = rounds
      .filter((r) => !r.is_bye && r.won_match !== null)
      .sort((a, b) => a.round_number - b.round_number);
    let cumWins = 0;
    return played.map((r, i) => {
      if (r.won_match) cumWins++;
      return {
        round: r.round_number,
        rate: Math.round((cumWins / (i + 1)) * 1000) / 10,
        result: r.won_match ? "win" : "loss",
      };
    });
  }, [rounds]);
  const winRate = chartData.length ? chartData[chartData.length - 1].rate : null;

  // Leader chosen at session creation, falling back to the first round that has one
  const [heroLeaderOverride, setHeroLeaderOverride] = useState<DeckIdentifier | null>(null);
  const heroLeader: DeckIdentifier | null =
    heroLeaderOverride ??
    (session?.player_leader as DeckIdentifier | null) ??
    rounds.find((r) => r.player_leader)?.player_leader ??
    null;

  const handleHeroLeaderChange = async (leader: DeckIdentifier) => {
    setHeroLeaderOverride(leader);
    try {
      await updateSessionDetails({
        data: { session_id: sessionId, player_leader_id: leader.id },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el leader");
    }
  };

  const occupiedNumbers = useMemo(() => new Set(rounds.map((r) => r.round_number)), [rounds]);
  const nextRoundNumber = useMemo(() => {
    let n = 1;
    while (occupiedNumbers.has(n)) n++;
    return n;
  }, [occupiedNumbers]);

  const addRound = () => {
    setRounds((prev) =>
      [
        ...prev,
        {
          round_number: nextRoundNumber,
          is_bye: false,
          player_leader: null,
          player_leader_id: null,
          opponent_leader: null,
          opponent_leader_id: null,
          opponent_player_id: null,
          won_die_roll: null,
          turn_order: null,
          won_match: null,
          notes: null,
        },
      ].sort((a, b) => a.round_number - b.round_number),
    );
  };

  const updateRound = (idx: number, patch: Partial<RoundState>) => {
    setRounds((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSave = async (idx: number): Promise<boolean> => {
    const r = rounds[idx];
    if (!r.is_bye && !r.opponent_leader_id) {
      toast.error("Selecciona el leader del oponente para guardar la ronda");
      return false;
    }
    setSavingIdx(idx);
    try {
      await saveRound({
        data: {
          session_id: sessionId,
          round_number: r.round_number,
          is_bye: r.is_bye,
          player_leader_id: r.player_leader_id ?? heroLeader?.id ?? null,
          opponent_leader_id: r.opponent_leader_id,
          opponent_player_id: r.opponent_player_id,
          won_die_roll: r.won_die_roll,
          turn_order: r.turn_order,
          won_match: r.won_match,
          notes: r.notes,
        },
      });
      toast.success(`Ronda ${r.round_number} guardada`);
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
      return false;
    } finally {
      setSavingIdx(null);
    }
  };

  const handleDelete = async (idx: number) => {
    const r = rounds[idx];
    setDeletingIdx(idx);
    try {
      await delRound({ data: { session_id: sessionId, round_number: r.round_number } });
      setRounds((prev) => prev.filter((_, i) => i !== idx));
      toast.success(`Ronda ${r.round_number} eliminada`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
    } finally {
      setDeletingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Merged header — identity/rename, delete/status, leader, record & win-rate trend */}
      <div className="glass relative overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-6">
        {/* Top row — name/rename + meta, status + delete */}
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {session?.session_type === "competitive" ? (
              <Trophy size={20} className="flex-shrink-0 text-primary" />
            ) : (
              <Swords size={20} className="flex-shrink-0 text-gray-400" />
            )}
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                {header.editingDetails ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-wrap items-center gap-1.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") header.onSaveDetails();
                      if (e.key === "Escape") header.setEditingDetails(false);
                    }}
                  >
                    <input
                      autoFocus
                      value={header.nameDraft}
                      onChange={(e) => header.setNameDraft(e.target.value)}
                      maxLength={100}
                      placeholder="Nombre de la partida"
                      className="w-full max-w-[200px] rounded-md border border-primary/40 bg-white/5 px-2 py-1 text-base font-bold text-white outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1">
                      <CalendarDays size={13} className="flex-shrink-0 text-gray-500" />
                      <input
                        type="date"
                        value={header.dateDraft}
                        onChange={(e) => header.setDateDraft(e.target.value)}
                        style={{ colorScheme: "dark" }}
                        className="bg-transparent text-xs text-white outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={header.onSaveDetails}
                      disabled={header.savingDetails || !header.nameDraft.trim()}
                      className="flex-shrink-0 rounded-md p-1.5 text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                      aria-label="Guardar cambios"
                    >
                      {header.savingDetails ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => header.setEditingDetails(false)}
                      className="flex-shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-white"
                      aria-label="Cancelar"
                    >
                      <X size={15} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="group flex min-w-0 items-center gap-1.5"
                  >
                    <h1 className="truncate text-xl font-bold text-white">
                      {session?.name ?? "Partida"}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        header.setNameDraft(session?.name ?? "");
                        header.setDateDraft(session?.session_date ?? "");
                        header.setEditingDetails(true);
                      }}
                      className="flex-shrink-0 rounded-md p-1 text-gray-600 opacity-100 transition hover:bg-white/5 hover:text-primary sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Editar nombre y fecha"
                    >
                      <Pencil size={13} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                <span>{session?.game_name}</span>
                {!header.editingDetails && session?.session_date && (
                  <>
                    <span>·</span>
                    <span>{formatDate(session.session_date)}</span>
                  </>
                )}
                {session?.session_time && (
                  <>
                    <span>·</span>
                    <span>{formatTime(session.session_time)}</span>
                  </>
                )}
                {session?.store_name && (
                  <>
                    <span>·</span>
                    <span>{session.store_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <StatusBadge status={session?.status} />
            {session?.status !== "matched" && (
              <button
                onClick={() => header.setDeleteConfirming(true)}
                className="rounded-md p-2.5 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label="Eliminar partida"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {/* Delete confirmation — full-row overlay */}
          <AnimatePresence>
            {header.deleteConfirming && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-20 flex items-center justify-between gap-3 rounded-xl bg-red-950/95 px-4 backdrop-blur-sm"
              >
                <span className="truncate text-sm font-medium text-red-100">
                  ¿Eliminar "{session?.name}"?
                </span>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={header.onDelete}
                    disabled={header.deleting}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {header.deleting ? "…" : "Eliminar"}
                  </button>
                  <button
                    onClick={() => header.setDeleteConfirming(false)}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status banners */}
        {session?.status === "matched" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <Link2 size={14} className="flex-shrink-0" />
              <span>
                Vinculada al torneo de{" "}
                <strong>{session.tournament_store_name ?? "—"}</strong>
                {session.tournament_date && <> · {formatDate(session.tournament_date)}</>}
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {header.undoConfirming ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5"
                >
                  <span className="text-xs text-gray-300">¿Deshacer?</span>
                  <button
                    onClick={header.onUndo}
                    disabled={header.undoing}
                    className="rounded-md bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {header.undoing ? "…" : "Sí"}
                  </button>
                  <button
                    onClick={() => header.setUndoConfirming(false)}
                    className="rounded-md border border-white/10 px-3 py-2 text-xs text-gray-300"
                  >
                    No
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="trigger"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => header.setUndoConfirming(true)}
                  className="flex items-center gap-1 text-xs text-red-400 transition hover:underline"
                >
                  <Link2Off size={12} /> Deshacer vínculo
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}

        {session?.status === "unlinked" && session?.session_type === "competitive" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-300">
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span>
                Pendiente de vinculación. Se vinculará automáticamente cuando el organizador
                publique el torneo.
              </span>
            </div>
            <button
              onClick={header.onLinkManually}
              className="text-xs text-primary transition hover:underline"
            >
              Vincular manualmente
            </button>
          </div>
        )}

        {/* Leader, record & win-rate — same card, below a divider */}
        <div className="mt-5 flex items-end gap-4 border-t border-white/10 pt-4">
          <HeroLeaderPicker gameId={gameId} value={heroLeader} onChange={handleHeroLeaderChange} />

          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs uppercase tracking-widest text-gray-600">Récord</p>
            <p className="font-mono text-lg font-bold text-white">
              <span className="text-emerald-400">{wins}V</span>
              <span className="text-gray-600"> · </span>
              <span className="text-red-400">{losses}D</span>
            </p>
          </div>

          {chartData.length >= 2 && (
            <div className="flex-shrink-0 pb-1 text-right">
              <p className="text-xs uppercase tracking-widest text-gray-600">% de victorias</p>
              <p className="font-mono text-2xl font-bold text-white">{winRate}%</p>
            </div>
          )}
        </div>

        {/* Win-rate trend, same card, below the leader row */}
        {chartData.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3"
          >
            <div className="mb-2 flex items-center justify-end gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Victoria
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400" /> Derrota
              </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="winRateFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="round"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--foreground-subtle)", fontSize: 12 }}
                  tickFormatter={(v) => `R${v}`}
                />
                <YAxis hide domain={[0, 100]} />
                <ReferenceLine y={50} stroke="var(--border)" strokeDasharray="3 3" />
                <Tooltip content={<WinRateTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--success)"
                  strokeWidth={2}
                  fill="url(#winRateFill)"
                  dot={<ResultDot />}
                  activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Table header */}
      {rounds.length > 0 && (
        <div className="grid grid-cols-[28px_1fr_40px_40px_28px] gap-2 px-3 pb-1 sm:grid-cols-[40px_1fr_52px_52px_52px]">
          <span className="text-xs uppercase tracking-wide text-gray-600">#</span>
          <span className="text-xs uppercase tracking-wide text-gray-600">Rival</span>
          <span className="text-center text-xs uppercase tracking-wide text-gray-600">
            Dado
          </span>
          <span className="text-center text-xs uppercase tracking-wide text-gray-600">
            Turno
          </span>
          <span className="text-center text-xs uppercase tracking-wide text-gray-600">
            <span className="sm:hidden">V/D</span>
            <span className="hidden sm:inline">Resultado</span>
          </span>
        </div>
      )}

      {/* Round list */}
      {rounds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
          <p className="text-sm text-gray-500">Sin rondas registradas aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {rounds.map((r, idx) => (
              <motion.div
                key={r.id ?? `new-${r.round_number}`}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <StandaloneRoundCard
                  round={r}
                  gameId={gameId}
                  onChange={(patch) => updateRound(idx, patch)}
                  onSave={() => handleSave(idx)}
                  onDelete={() => handleDelete(idx)}
                  saving={savingIdx === idx}
                  deleting={deletingIdx === idx}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Floating add button — mobile */}
      {!isLocked && (
        <button
          type="button"
          onClick={addRound}
          aria-label="Agregar Ronda"
          className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition hover:brightness-110 active:scale-95 sm:hidden"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Desktop add button */}
      {!isLocked && (
        <button
          type="button"
          onClick={addRound}
          className="hidden sm:flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm font-medium text-gray-400 transition hover:border-primary hover:text-primary"
        >
          <Plus size={15} /> Agregar Ronda
        </button>
      )}
    </div>
  );
}

// ============================================================
// DisambiguationPicker
// ============================================================
function DisambiguationPicker({
  sessionId,
  open,
  onClose,
  onLinked,
}: {
  sessionId: string;
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
}) {
  const fetchCandidates = useServerFn(getTournamentCandidates);
  const linkFn = useServerFn(linkSessionManually);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [homeZone, setHomeZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open) {
      setCandidates([]);
      setShowAll(false);
      setSelectedId(null);
      setConfirming(false);
      return;
    }
    setLoading(true);
    fetchCandidates({ data: { session_id: sessionId } })
      .then((res) => {
        setCandidates(res.candidates as Candidate[]);
        setHomeZone(res.home_zone);
      })
      .catch((e: any) => toast.error(e?.message ?? "Error al buscar candidatos"))
      .finally(() => setLoading(false));
  }, [open, sessionId, fetchCandidates]);

  const homeZoneCandidates = candidates.filter((c) => c.is_home_zone);
  const otherCandidates = candidates.filter((c) => !c.is_home_zone);
  const visibleCandidates = showAll
    ? candidates
    : homeZoneCandidates.length > 0
      ? homeZoneCandidates
      : candidates.slice(0, 3);

  const selectedCandidate = candidates.find((c) => c.id === selectedId) ?? null;

  const handleConfirmLink = async () => {
    if (!selectedId) return;
    setLinking(true);
    try {
      await linkFn({ data: { session_id: sessionId, tournament_id: selectedId } });
      toast.success("Partida vinculada correctamente");
      onLinked();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al vincular");
    } finally {
      setLinking(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 pointer-events-none">
            <motion.div
              initial={{ y: "100%", opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="pointer-events-auto glass w-full max-w-lg rounded-t-2xl border border-white/10 bg-black/90 shadow-2xl sm:rounded-2xl"
              style={{ maxHeight: "80vh" }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="text-base font-bold text-white">Vincular manualmente</h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-gray-500 hover:bg-white/5 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(80vh - 60px)" }}>
                {confirming && selectedCandidate ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-300">
                      ¿Vincular esta partida al siguiente torneo?
                    </p>
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-sm font-semibold text-white">
                        {selectedCandidate.store_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {selectedCandidate.store_city} ·{" "}
                        {formatDate(selectedCandidate.tournament_date)} ·{" "}
                        {formatTime(selectedCandidate.tournament_time)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmLink}
                        disabled={linking}
                        className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50 transition hover:brightness-110"
                      >
                        {linking ? "Vinculando…" : "Confirmar"}
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-gray-300 transition hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="space-y-2">
                    <SkeletonBlock className="h-16 rounded-xl" />
                    <SkeletonBlock className="h-16 rounded-xl" />
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-400">
                      No encontramos torneos publicados que coincidan con la fecha de esta sesión.
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      El organizador puede no haber subido los resultados aún.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {homeZone && homeZoneCandidates.length > 0 && (
                      <p className="text-xs uppercase tracking-widest text-gray-500">
                        Tu zona · {homeZone}
                      </p>
                    )}

                    {visibleCandidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedId(c.id);
                          setConfirming(true);
                        }}
                        className="flex w-full items-start justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{c.store_name}</p>
                          <p className="text-xs text-gray-400">
                            {c.store_city} · {formatDate(c.tournament_date)} ·{" "}
                            {formatTime(c.tournament_time)}
                          </p>
                        </div>
                        <span className="ml-3 flex-shrink-0 text-xs text-gray-500">
                          ~{c.diff_hours.toFixed(1)}h
                        </span>
                      </button>
                    ))}

                    {otherCandidates.length > 0 && !showAll && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="w-full rounded-xl border border-dashed border-white/10 py-2.5 text-xs text-gray-400 transition hover:border-white/20 hover:text-white"
                      >
                        Mostrar más opciones ({otherCandidates.length} en otras zonas)
                      </button>
                    )}
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

// ============================================================
// SessionDetailPage
// ============================================================
function SessionDetailPage() {
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  const navigate = useNavigate();
  const { player, loading: roleLoading } = useNexusRole();

  const fetchDetail = useServerFn(getStandaloneSessionDetail);
  const undoLink = useServerFn(undoSessionLink);
  const deleteFn = useServerFn(deleteStandaloneSession);
  const updateDetailsFn = useServerFn(updateStandaloneSessionDetails);

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [undoConfirming, setUndoConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const [loadError, setLoadError] = useState(false);
  const loadDetail = () => {
    setLoading(true);
    setLoadError(false);
    fetchDetail({ data: { session_id: sessionId } })
      .then(setDetail)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (roleLoading || !player) return;
    loadDetail();
  }, [sessionId, player, roleLoading]);

  const handleUndo = async () => {
    setUndoing(true);
    try {
      await undoLink({ data: { session_id: sessionId } });
      toast.success("Vínculo deshecho");
      setUndoConfirming(false);
      loadDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al deshacer");
      setUndoConfirming(false);
    } finally {
      setUndoing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFn({ data: { session_id: sessionId } });
      toast.success("Partida eliminada");
      navigate({ to: "/sessions" });
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
      setDeleteConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleDetailsSave = async () => {
    const trimmedName = nameDraft.trim();
    if (!trimmedName) return;
    setSavingDetails(true);
    try {
      await updateDetailsFn({
        data: {
          session_id: sessionId,
          name: trimmedName,
          session_date: dateDraft || null,
        },
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              session: { ...prev.session, name: trimmedName, session_date: dateDraft || null },
            }
          : prev,
      );
      setEditingDetails(false);
      toast.success("Partida actualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar la partida");
    } finally {
      setSavingDetails(false);
    }
  };

  if (!roleLoading && !player) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Debes iniciar sesión</h2>
        <Link
          to="/login"
          className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const session = detail?.session as
    | (SessionData & {
        game_name: string;
        store_name: string | null;
        store_city: string | null;
      })
    | null;
  const rounds = detail?.rounds ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:pb-10">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-gray-500">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-1 transition hover:text-primary"
        >
          <ArrowLeft size={12} /> Mis Partidas
        </Link>
        <span>/</span>
        <span className="text-gray-300">{session?.name ?? "…"}</span>
      </div>

      {/* Session overview + round tracker — one merged card, then the rounds */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonBlock className="h-48 rounded-2xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
        </div>
      ) : session ? (
        <StandaloneRoundTracker
          sessionId={sessionId}
          gameId={session.game_id}
          initialRounds={rounds}
          sessionStatus={session.status}
          session={session}
          header={{
            editingDetails,
            setEditingDetails,
            nameDraft,
            setNameDraft,
            dateDraft,
            setDateDraft,
            savingDetails,
            onSaveDetails: handleDetailsSave,
            deleteConfirming,
            setDeleteConfirming,
            deleting,
            onDelete: handleDelete,
            undoConfirming,
            setUndoConfirming,
            undoing,
            onUndo: handleUndo,
            onLinkManually: () => setPickerOpen(true),
          }}
        />
      ) : loadError ? (
        <InlineError onRetry={loadDetail}>No pudimos cargar la partida.</InlineError>
      ) : null}

      {/* Disambiguation picker */}
      <DisambiguationPicker
        sessionId={sessionId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onLinked={loadDetail}
      />
    </div>
  );
}
