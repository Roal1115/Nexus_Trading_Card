import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Eye, ArrowRight, FileDown, FileX } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getManagerPendingTournaments } from "@/lib/geekarena-manager.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/tcg-manager/")({
  component: ManagerPendingTournaments,
});

type Row = {
  id: string;
  tournament_date: string;
  status: string;
  created_at: string;
  csv_url: string | null;
  store_id: string;
  game_id: string;
  stores: { name: string; city: string | null; state: string | null } | null;
  games: { name: string } | null;
};

function ManagerPendingTournaments() {
  const navigate = useNavigate();
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;
  const fetchList = useServerFn(getManagerPendingTournaments);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchList();
        setRows(res as unknown as Row[]);
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [email, fetchList]);

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
          Moderación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Torneos Pendientes
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Revisa los torneos en estado borrador de los TCGs que tienes asignados.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          No hay torneos pendientes en tus TCGs.
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
                  <th className="px-4 py-3">Subido el</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">CSV</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() =>
                      navigate({ to: "/tcg-manager/tournaments/$id", params: { id: r.id } })
                    }
                    className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {r.stores?.name ?? "—"}
                      {r.stores?.city ? (
                        <span className="block text-xs text-gray-500">
                          {r.stores.city}
                          {r.stores.state ? `, ${r.stores.state}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.games?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString("es-MX")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate({
                            to: "/tcg-manager/tournaments/$id",
                            params: { id: r.id },
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                      >
                        <Eye size={13} />
                        Revisar
                        <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
