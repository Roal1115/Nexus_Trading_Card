import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trophy,
  Swords,
  CheckCircle2,
  ShieldQuestion,
  Dices,
  Rocket,
  ShieldHalf,
  StickyNote,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { getTournamentSessionDetail } from "@/lib/nexus-standalone.functions";
import {
  cleanLeaderName,
  RoundCardFrame,
  RoundFieldLabel,
  type DeckIdentifier,
} from "@/components/tournament-tracker/round-ui";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/sessions/tournament/$tournamentId")({
  head: () => ({ meta: [{ title: "Torneo — Nexus" }] }),
  component: SessionDetailPage,
});

// ============================================================
// Types
// ============================================================
type SessionDetail = Awaited<ReturnType<typeof getTournamentSessionDetail>>;
type SessionData = SessionDetail["session"];
type RoundData = SessionDetail["rounds"][number];

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

// ============================================================
// StatusBadge
// ============================================================
function StatusBadge({ status }: { status: string }) {
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

function RoundBadge({ active, icon, label }: { active: boolean; icon: ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-white/10 bg-white/5 text-gray-400"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function StandaloneRoundCard({ round }: { round: RoundState }) {
  return (
    <RoundCardFrame
      round={round}
      opponentLabel={round.opponent_leader ? cleanLeaderName(round.opponent_leader.base_name) : "—"}
    >
      {() => (
        <>
          <div>
            <RoundFieldLabel>Leader del oponente</RoundFieldLabel>
            <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
              {round.opponent_leader
                ? cleanLeaderName(round.opponent_leader.base_name)
                : "Sin leader registrado"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {round.won_die_roll !== null && (
              <RoundBadge
                active={round.won_die_roll}
                icon={<Dices size={10} />}
                label={round.won_die_roll ? "Gané dado" : "Perdí dado"}
              />
            )}
            {round.turn_order && (
              <RoundBadge
                active={round.turn_order === "first"}
                icon={
                  round.turn_order === "first" ? <Rocket size={10} /> : <ShieldHalf size={10} />
                }
                label={round.turn_order === "first" ? "Primero" : "Segundo"}
              />
            )}
            {round.notes && (
              <RoundBadge active={false} icon={<StickyNote size={10} />} label="Con notas" />
            )}
          </div>

          {round.notes && (
            <div>
              <RoundFieldLabel>Notas</RoundFieldLabel>
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-300">
                {round.notes}
              </p>
            </div>
          )}
        </>
      )}
    </RoundCardFrame>
  );
}

// ============================================================
// StandaloneRoundTracker (read-only — official tournament rounds are not editable here)
// ============================================================
function StandaloneRoundTracker({
  gameId,
  initialRounds,
  session,
}: {
  gameId: string;
  initialRounds: RoundData[];
  session: any;
}) {
  const rounds: RoundState[] = initialRounds.map((r) => ({
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
  }));

  const wins = rounds.filter((r) => r.won_match === true).length;
  const losses = rounds.filter((r) => r.won_match === false).length;

  const heroLeader: DeckIdentifier | null =
    (session?.player_leader as DeckIdentifier | null) ??
    rounds.find((r) => r.player_leader)?.player_leader ??
    null;

  return (
    <div className="space-y-4">
      {/* Hero header — leader image + record */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <div className="flex items-end gap-4 p-4">
          {/* Leader image */}
          <div className="relative flex-shrink-0">
            {heroLeader?.card_image ? (
              <img
                src={heroLeader.card_image}
                alt={heroLeader.base_name}
                className="h-24 w-16 rounded-xl border border-white/20 object-cover shadow-xl"
              />
            ) : (
              <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-white/10 bg-black/40">
                <ShieldQuestion size={20} className="text-gray-600" />
              </div>
            )}
            {/* W-L overlay */}
            {(wins > 0 || losses > 0) && (
              <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                <span className="rounded-full bg-black/80 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  <span className="text-emerald-400">{wins}V</span>
                  <span className="text-gray-500"> · </span>
                  <span className="text-red-400">{losses}D</span>
                </span>
              </div>
            )}
          </div>

          {/* Session info */}
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-lg font-bold text-white truncate">{session?.name ?? "Torneo"}</p>
            <p className="text-xs text-gray-500">
              {session?.session_date
                ? new Date(session.session_date + "T00:00:00").toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Sin fecha"}
              {session?.store_name ? ` · ${session.store_name}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Table header */}
      {rounds.length > 0 && (
        <div className="grid grid-cols-[40px_1fr_52px_52px_52px] gap-2 px-3 pb-1">
          <span className="text-[10px] uppercase tracking-widest text-gray-600">Round</span>
          <span className="text-[10px] uppercase tracking-widest text-gray-600">Deck</span>
          <span className="text-center text-[10px] uppercase tracking-widest text-gray-600">
            Dado
          </span>
          <span className="text-center text-[10px] uppercase tracking-widest text-gray-600">
            Turno
          </span>
          <span className="text-center text-[10px] uppercase tracking-widest text-gray-600">
            Res
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
          {rounds.map((r) => (
            <StandaloneRoundCard key={r.id ?? `round-${r.round_number}`} round={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SessionDetailPage
// ============================================================
function SessionDetailPage() {
  const { tournamentId } = useParams({ from: "/sessions/tournament/$tournamentId" });
  const { player, loading: roleLoading } = useNexusRole();

  const fetchDetail = useServerFn(getTournamentSessionDetail);

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = () => {
    setLoading(true);
    fetchDetail({ data: { tournament_id: tournamentId } })
      .then(setDetail)
      .catch((e: any) => toast.error(e?.message ?? "Error al cargar torneo"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (roleLoading || !player) return;
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, player, roleLoading]);

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

      {/* Header card */}
      {loading ? (
        <SkeletonBlock className="h-40 rounded-2xl mb-6" />
      ) : session ? (
        <div className="glass mb-6 rounded-2xl border border-white/10 p-6">
          {/* Top row */}
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Trophy size={20} className="flex-shrink-0 text-primary" />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-white">{session.name}</h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                  <span>{session.game_name}</span>
                  {session.session_date && (
                    <>
                      <span>·</span>
                      <span>{formatDate(session.session_date)}</span>
                    </>
                  )}
                  {session.store_name && (
                    <>
                      <span>·</span>
                      <span>{session.store_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={session.status} />
            </div>
          </div>

          {/* Read-only status banner — official tournament, always matched */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-400" />
            <span className="text-sm text-emerald-300">
              Torneo oficial · {session?.store_name ?? "—"} ·{" "}
              {formatDate(session?.session_date ?? null)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Round tracker (read-only) */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonBlock className="h-24 rounded-xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
        </div>
      ) : session ? (
        <StandaloneRoundTracker gameId={session.game_id} initialRounds={rounds} session={session} />
      ) : null}
    </div>
  );
}
