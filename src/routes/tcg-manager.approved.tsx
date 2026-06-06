import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Eye, ArrowRight, FileDown, FileX } from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getManagerApprovedTournaments,
  managerUndoApproval,
} from "@/lib/geekarena-manager.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tcg-manager/approved")({
  component: ManagerApprovedTournaments,
});

type Row = {
  id: string;
  tournament_date: string;
  status: string;
  approved_at: string | null;
  undo_deadline: string | null;
  csv_url: string | null;
  store_id: string;
  game_id: string;
  stores: { name: string; city: string | null; state: string | null } | null;
  games: { name: string } | null;
};

function formatCountdown(target: string | null): { text: string; expired: boolean } {
  if (!target) return { text: "—", expired: true };
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { text: "expirada", expired: true };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { text: `${hours}h ${minutes}m`, expired: false };
}

function ManagerApprovedTournaments() {
  const navigate = useNavigate();
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;
  const fetchList = useServerFn(getManagerApprovedTournaments);
  const undoFn = useServerFn(managerUndoApproval);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetchList();
      setRows(res as unknown as Row[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const onUndo = async (id: string) => {
    setActingId(id);
    try {
      await undoFn({ data: { tournament_id: id } });
      toast.success("Aprobación deshecha");
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Publicación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Torneos Aprobados
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Tienes 48 horas para deshacer una aprobación si fue un error.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          No hay torneos aprobados en tus TCGs.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tienda</th>
                  <th className="px-4 py-3">Juego</th>
                  <th className="px-4 py-3">Ventana corrección</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">CSV</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cd = formatCountdown(r.undo_deadline);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-white/5 transition hover:bg-white/5"
                    >
                      <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {r.stores?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{r.games?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {cd.expired ? (
                          <span className="text-gray-500">Expirada</span>
                        ) : (
                          <span className="text-yellow-300">{cd.text} restantes</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {r.csv_url ? (
                          <a
                            href={r.csv_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileDown size={12} />
                            Ver CSV
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <FileX size={12} />
                            Sin archivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {!cd.expired && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actingId === r.id}
                              onClick={() => onUndo(r.id)}
                            >
                              {actingId === r.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                "Deshacer"
                              )}
                            </Button>
                          )}
                          <button
                            onClick={() =>
                              navigate({
                                to: "/tcg-manager/tournaments/$id",
                                params: { id: r.id },
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                          >
                            <Eye size={13} />
                            Ver
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
