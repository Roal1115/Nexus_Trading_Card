import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getMyTournaments,
  deleteDraftTournament,
} from "@/lib/geekarena-organizer.functions";
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

export const Route = createFileRoute("/organizer/tournaments")({
  component: TournamentsPage,
});

type Row = {
  id: string;
  game_id: string;
  game_name: string;
  tournament_date: string;
  status: string;
  csv_url: string | null;
  rejection_reason?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  APPROVED: "default",
  PUBLISHED: "default",
};

function TournamentsPage() {
  const { player, loading: roleLoading } = useGeekarenaRole();
  const email = player?.email ?? null;
  const fetchList = useServerFn(getMyTournaments);
  const removeDraft = useServerFn(deleteDraftTournament);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async (em: string) => {
    setLoading(true);
    try {
      const res = await fetchList();
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

  const handleDelete = async (id: string) => {
    if (!email) return;
    try {
      await removeDraft({ data: { tournament_id: id } });
      toast.success("Torneo eliminado");
      await refresh(email);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Mis Torneos
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Torneos de tu tienda
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Borradores y torneos enviados a revisión.
          </p>
        </div>
        <Button asChild>
          <Link to="/organizer/new">
            <Plus size={14} className="mr-1" />
            Subir torneo
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          Aún no has registrado torneos. Pulsa <strong>Subir torneo</strong>{" "}
          para empezar.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Juego</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">CSV</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white">
                      {r.tournament_date}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
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
                      {r.status === "DRAFT" ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 size={14} className="text-red-400" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                ¿Eliminar este torneo?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Solo puedes
                                eliminar torneos en estado Borrador.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(r.id)}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
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
