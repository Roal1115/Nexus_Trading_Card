import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { listTournamentsByStatus } from "@/lib/geekarena-admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  component: PendingTournaments,
});

type Row = {
  id: string;
  tournament_date: string;
  game_name: string;
  status: string;
  csv_url: string | null;
  store: { name: string; city: string | null; state: string | null };
};

function PendingTournaments() {
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;
  const fetchList = useServerFn(listTournamentsByStatus);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchList({ data: { statuses: ["DRAFT"] } });
        setRows(res.tournaments as Row[]);
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
          Revisa borradores enviados por organizadores. Abre el detalle para
          aprobar o rechazar.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          No hay torneos pendientes.
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
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">CSV</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {r.store.name}
                      {r.store.city ? (
                        <span className="block text-xs text-gray-500">
                          {r.store.city}
                          {r.store.state ? `, ${r.store.state}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.csv_url ? (
                        <a
                          href={r.csv_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Ver <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" asChild>
                        <Link to="/admin/tournaments/$id" params={{ id: r.id }}>
                          <Eye size={14} className="mr-1" /> Revisar
                        </Link>
                      </Button>
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
