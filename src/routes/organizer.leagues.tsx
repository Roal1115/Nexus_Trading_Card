import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Settings, Archive, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TournamentRowSkeleton } from "@/components/ui/skeleton-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getOrganizerOverview, listStoreLeagues, createStoreLeague, archiveStoreLeague } from "@/lib/nexus-organizer.functions";

export const Route = createFileRoute("/organizer/leagues")({
  component: OrganizerLeaguesPage,
});

const WEEKDAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
];
const ALL_WEEKDAYS = WEEKDAYS.map((d) => d.value);

type League = {
  id: string;
  name: string;
  status: "active" | "archived";
  start_date: string;
  end_date: string;
  active_weekdays: number[];
  winner_player_id: string | null;
  winner_points: number | null;
  store_league_tournaments: { tournament_id: string }[];
  store_league_prizes: Array<{ id: string; description: string; image_url: string | null; sort_order: number }>;
};

const emptyForm = { name: "", start_date: "", end_date: "", active_weekdays: ALL_WEEKDAYS as number[] };

function OrganizerLeaguesPage() {
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getOrganizerOverview);
  const fetchLeagues = useServerFn(listStoreLeagues);
  const createFn = useServerFn(createStoreLeague);
  const archiveFn = useServerFn(archiveStoreLeague);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const refresh = async (sid: string) => {
    setLoading(true);
    try {
      const leaguesRes: any = await fetchLeagues({ data: { store_id: sid } });
      setLeagues(leaguesRes.leagues ?? []);
      setEnabled(leaguesRes.enabled ?? false);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const overview: any = await fetchOverview();
        const sid = overview.homeStore?.id ?? null;
        setStoreId(sid);
        if (sid) await refresh(sid);
        else setLoading(false);
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleWeekday(list: number[], day: number) {
    return list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort();
  }

  async function handleCreate() {
    if (!storeId || !form.name || !form.start_date || !form.end_date || form.active_weekdays.length === 0) {
      toast.error("Completa nombre, fechas y al menos un día activo.");
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await createFn({ data: { store_id: storeId, ...form } });
      toast.success("Liga interna creada.");
      setOpen(false);
      setForm(emptyForm);
      // La liga recién creada abre directo en su página de configuración —
      // torneos, premios y horarios no caben cómodamente en este modal.
      navigate({ to: "/organizer/leagues/$leagueId", params: { leagueId: res.league.id } });
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(id: string) {
    if (!storeId) return;
    if (!confirm("¿Archivar esta liga? Se calculará el ganador y no podrá editarse más.")) return;
    try {
      await archiveFn({ data: { league_id: id } });
      toast.success("Liga archivada.");
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  }

  const activeLeagues = leagues.filter((l) => l.status === "active");
  const archivedLeagues = leagues.filter((l) => l.status === "archived");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Ligas Internas
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Ligas de mi tienda</h1>
          <p className="mt-1 text-sm text-gray-400">
            Corre ligas locales en paralelo al Circuito Nacional. Selecciona qué torneos cuentan y sube los premios.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setForm(emptyForm);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!storeId || !enabled}>
              <Plus size={16} />
              Nueva liga
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva liga interna</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Liga de Verano 2026"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Días activos</Label>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAYS.map((d) => (
                    <label key={d.value} className="flex items-center gap-1.5 text-sm text-gray-300">
                      <Checkbox
                        checked={form.active_weekdays.includes(d.value)}
                        onCheckedChange={() =>
                          setForm((f) => ({ ...f, active_weekdays: toggleWeekday(f.active_weekdays, d.value) }))
                        }
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" size={16} /> : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TournamentRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : !storeId ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          Necesitas tener una tienda asignada para crear ligas internas.
        </div>
      ) : !enabled ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          Tu tienda no tiene habilitado el plugin de Ligas Internas. Contacta al administrador para activarlo.
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Ligas activas</h2>
            {activeLeagues.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-sm text-gray-400">No hay ligas activas.</div>
            ) : (
              <div className="glass overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Vigencia</th>
                        <th className="px-4 py-3">Torneos</th>
                        <th className="px-4 py-3">Premios</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLeagues.map((l) => (
                        <tr key={l.id} className="border-t border-white/5">
                          <td className="px-4 py-3 text-white">
                            <Link
                              to="/organizer/leagues/$leagueId"
                              params={{ leagueId: l.id }}
                              className="flex items-center gap-2 hover:text-primary"
                            >
                              <Trophy size={14} className="text-primary" />
                              {l.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {l.start_date} — {l.end_date}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{l.store_league_tournaments.length}</td>
                          <td className="px-4 py-3 text-gray-300">{l.store_league_prizes.length}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link
                                to="/organizer/leagues/$leagueId"
                                params={{ leagueId: l.id }}
                                className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
                              >
                                <Settings size={12} />
                                Configurar
                              </Link>
                              <button
                                onClick={() => handleArchive(l.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                              >
                                <Archive size={12} />
                                Archivar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Hall of Fame — Ligas archivadas</h2>
            {archivedLeagues.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-sm text-gray-400">Aún no hay ligas archivadas.</div>
            ) : (
              <div className="glass overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Vigencia</th>
                        <th className="px-4 py-3">Ganador</th>
                        <th className="px-4 py-3">Puntos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedLeagues.map((l) => (
                        <tr key={l.id} className="border-t border-white/5">
                          <td className="px-4 py-3 text-white">
                            <Link to="/organizer/leagues/$leagueId" params={{ leagueId: l.id }} className="hover:text-primary">
                              {l.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {l.start_date} — {l.end_date}
                          </td>
                          <td className="px-4 py-3">
                            {l.winner_player_id ? (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                                {l.winner_player_id}
                              </Badge>
                            ) : (
                              <span className="text-gray-500">Sin resultados</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{l.winner_points ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
