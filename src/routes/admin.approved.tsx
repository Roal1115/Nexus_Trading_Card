import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Upload, Eye, ArrowRight, FileDown, FileX } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  listTournamentsByStatus,
  publishTournaments,
} from "@/lib/geekarena-admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/admin/approved")({
  component: ApprovedTournaments,
});

type Row = {
  id: string;
  tournament_date: string;
  game_name: string;
  status: string;
  csv_url: string | null;
  qualifying_month: number;
  qualifying_year: number;
  store: { name: string; city: string | null; state: string | null };
};

function ApprovedTournaments() {
  const navigate = useNavigate();
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;
  const fetchList = useServerFn(listTournamentsByStatus);
  const publish = useServerFn(publishTournaments);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);

  const refresh = async (em: string) => {
    setLoading(true);
    try {
      const res = await fetchList({
        data: { statuses: ["APPROVED"] },
      });
      setRows(res.tournaments as Row[]);
      setSelected({});
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

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const onPublish = async () => {
    if (!email || selectedIds.length === 0) return;
    setPublishing(true);
    try {
      const res = await publish({
        data: { tournament_ids: selectedIds },
      });
      toast.success(`${res.published} torneos publicados — leaderboard actualizado`);
      await refresh(email);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected[r.id]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Publicación
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Torneos Aprobados
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Selecciona los torneos a publicar. El leaderboard se recalculará al
            publicar.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={selectedIds.length === 0 || publishing}>
              <Upload size={14} className="mr-1" />
              Publicar seleccionados ({selectedIds.length})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Confirmas que deseas publicar {selectedIds.length} torneos?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción actualizará el leaderboard global.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onPublish}>
                Publicar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          No hay torneos aprobados pendientes de publicación.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => {
                        if (v) {
                          const all: Record<string, boolean> = {};
                          rows.forEach((r) => (all[r.id] = true));
                          setSelected(all);
                        } else setSelected({});
                      }}
                    />
                  </th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tienda</th>
                  <th className="px-4 py-3">Juego</th>
                  <th className="px-4 py-3">Periodo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">CSV</th>
                  <th className="px-4 py-3 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate({ to: "/admin/tournaments/$id", params: { id: r.id } })}
                    className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={(v) =>
                          setSelected((s) => ({ ...s, [r.id]: !!v }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                    <td className="px-4 py-3 text-gray-300">{r.store.name}</td>
                    <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {r.qualifying_year}-
                      {String(r.qualifying_month).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <FileLink url={r.csv_url} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate({ to: "/admin/tournaments/$id", params: { id: r.id } });
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
