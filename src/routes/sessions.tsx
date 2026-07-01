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
import { SkeletonBlock } from "@/components/ui/skeleton-loader";


export const Route = createFileRoute("/sessions")({
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
    navigate({ to: "/sessions/$sessionId", params: { sessionId: session.id } });
  };

  return (
    <div
      onClick={goToDetail}
      className="glass group flex cursor-pointer items-center gap-4 rounded-2xl border border-white/10 p-4 transition hover:border-primary/40 hover:bg-white/[0.04]"
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
        {confirming ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5"
          >
            <span className="text-[11px] text-gray-300">¿Confirmar?</span>
            <button
              onClick={() => {
                onDelete(session.id);
                setConfirming(false);
              }}
              disabled={isDeleting}
              className="rounded-md bg-red-500/20 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/30 transition disabled:opacity-50"
            >
              Sí
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-gray-300 hover:border-white/20 transition"
            >
              No
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
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
  const [, setShowCreateSheet] = useState(false);

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
    </main>
  );
}
