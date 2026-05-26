import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  listTournamentsByStatus,
  approveTournament,
  rejectTournament,
} from "@/lib/geekarena-admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const approve = useServerFn(approveTournament);
  const reject = useServerFn(rejectTournament);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async (em: string) => {
    setLoading(true);
    try {
      const res = await fetchList({
        data: { statuses: ["DRAFT"] },
      });
      setRows(res.tournaments as Row[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    refresh(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const onApprove = async (id: string) => {
    if (!email) return;
    try {
      await approve({ data: { tournament_id: id } });
      toast.success("Torneo aprobado");
      await refresh(email);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };
  const onReject = async (id: string) => {
    if (!email) return;
    try {
      await reject({ data: { tournament_id: id } });
      toast.success("Torneo rechazado");
      await refresh(email);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
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
          Moderación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Torneos Pendientes
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Revisa borradores y torneos enviados por organizadores. Al aprobar
          pasarán a la cola para publicación.
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
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => onApprove(r.id)}>
                          <Check size={14} className="mr-1" /> Aprobar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <X size={14} className="text-red-400" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                ¿Rechazar este torneo?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                El organizador deberá volver a subirlo si fue
                                un error.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onReject(r.id)}>
                                Rechazar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
