import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Pencil, Archive, Trophy, Gift, Loader2, Trash2, ImagePlus, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { TournamentRowSkeleton } from "@/components/ui/skeleton-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getOrganizerOverview,
  listStoreLeagues,
  createStoreLeague,
  updateStoreLeague,
  archiveStoreLeague,
  setLeagueTournaments,
  setLeaguePrizes,
  listStoreTournamentsForLeagues,
  listLeagueScheduleData,
  createLeagueSchedule,
  deleteLeagueSchedule,
} from "@/lib/nexus-organizer.functions";

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

type Prize = { description: string; image_url: string | null };
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
type Tournament = { id: string; game_name: string; tournament_date: string; status: string };
type NationalSchedule = { id: string; game_id: string; game_name: string; day_of_week: number; start_time: string };
type LeagueSchedule = {
  id: string;
  league_id: string;
  game_id: string;
  game_name: string;
  day_of_week: number;
  start_time: string;
  shares_national_slot: boolean;
  national_schedule_id: string | null;
};
type NewScheduleForm = { game_id: string; day_of_week: number; start_time: string };
const emptySchedule: NewScheduleForm = { game_id: "", day_of_week: 6, start_time: "18:00" };

const emptyForm = { name: "", start_date: "", end_date: "", active_weekdays: ALL_WEEKDAYS as number[] };

function OrganizerLeaguesPage() {
  const fetchOverview = useServerFn(getOrganizerOverview);
  const fetchLeagues = useServerFn(listStoreLeagues);
  const createFn = useServerFn(createStoreLeague);
  const updateFn = useServerFn(updateStoreLeague);
  const archiveFn = useServerFn(archiveStoreLeague);
  const fetchTournaments = useServerFn(listStoreTournamentsForLeagues);
  const setTournamentsFn = useServerFn(setLeagueTournaments);
  const setPrizesFn = useServerFn(setLeaguePrizes);
  const fetchScheduleData = useServerFn(listLeagueScheduleData);
  const createScheduleFn = useServerFn(createLeagueSchedule);
  const deleteScheduleFn = useServerFn(deleteLeagueSchedule);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [gamesList, setGamesList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [editing, setEditing] = useState<League | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [manageLeague, setManageLeague] = useState<League | null>(null);
  const [manageTournamentIds, setManageTournamentIds] = useState<Set<string>>(new Set());
  const [managePrizes, setManagePrizes] = useState<Prize[]>([]);
  const [manageSaving, setManageSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const [scheduleLeague, setScheduleLeague] = useState<League | null>(null);
  const [nationalSchedules, setNationalSchedules] = useState<NationalSchedule[]>([]);
  const [leagueSchedules, setLeagueSchedules] = useState<LeagueSchedule[]>([]);
  const [scheduleForm, setScheduleForm] = useState<NewScheduleForm>(emptySchedule);
  const [scheduleConflict, setScheduleConflict] = useState<NationalSchedule | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const refresh = async (sid: string) => {
    setLoading(true);
    try {
      const [leaguesRes, tournamentsRes]: any = await Promise.all([
        fetchLeagues({ data: { store_id: sid } }),
        fetchTournaments({ data: { store_id: sid } }),
      ]);
      setLeagues(leaguesRes.leagues ?? []);
      setEnabled(leaguesRes.enabled ?? false);
      setTournaments(tournamentsRes.tournaments ?? []);
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
        setGamesList(overview.games ?? []);
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
      await createFn({ data: { store_id: storeId, ...form } });
      toast.success("Liga interna creada.");
      setOpen(false);
      setForm(emptyForm);
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!editing || !storeId) return;
    setEditSubmitting(true);
    try {
      await updateFn({
        data: {
          league_id: editing.id,
          name: editing.name,
          start_date: editing.start_date,
          end_date: editing.end_date,
          active_weekdays: editing.active_weekdays,
        },
      });
      toast.success("Liga actualizada.");
      setEditing(null);
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setEditSubmitting(false);
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

  function openManage(league: League) {
    setManageLeague(league);
    setManageTournamentIds(new Set(league.store_league_tournaments.map((t) => t.tournament_id)));
    setManagePrizes(
      [...league.store_league_prizes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ description: p.description, image_url: p.image_url })),
    );
  }

  async function handlePrizeImageUpload(idx: number, file: File) {
    if (!manageLeague) return;
    setUploadingIdx(idx);
    try {
      const path = `${manageLeague.id}/${Date.now()}-${file.name}`;
      const { error } = await nexus.storage.from("league-assets").upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      const { data } = nexus.storage.from("league-assets").getPublicUrl(path);
      setManagePrizes((prev) => prev.map((p, i) => (i === idx ? { ...p, image_url: data.publicUrl } : p)));
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setUploadingIdx(null);
    }
  }

  async function handleSaveManage() {
    if (!manageLeague || !storeId) return;
    setManageSaving(true);
    try {
      await setTournamentsFn({
        data: { league_id: manageLeague.id, tournament_ids: Array.from(manageTournamentIds) },
      });
      await setPrizesFn({
        data: {
          league_id: manageLeague.id,
          prizes: managePrizes.filter((p) => p.description.trim().length > 0),
        },
      });
      toast.success("Liga actualizada.");
      setManageLeague(null);
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setManageSaving(false);
    }
  }

  async function openSchedule(league: League) {
    if (!storeId) return;
    setScheduleLeague(league);
    setScheduleForm(emptySchedule);
    setScheduleConflict(null);
    try {
      const res: any = await fetchScheduleData({ data: { store_id: storeId } });
      setNationalSchedules(res.national_schedules ?? []);
      setLeagueSchedules(res.league_schedules ?? []);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  }

  function findNationalConflict(form: NewScheduleForm) {
    return nationalSchedules.find((s) => s.game_id === form.game_id && s.day_of_week === form.day_of_week) ?? null;
  }

  async function submitSchedule(sharesNational: boolean, nationalScheduleId: string | null) {
    if (!scheduleLeague || !scheduleForm.game_id) {
      toast.error("Elige un juego.");
      return;
    }
    setScheduleSaving(true);
    try {
      await createScheduleFn({
        data: {
          league_id: scheduleLeague.id,
          game_id: scheduleForm.game_id,
          day_of_week: scheduleForm.day_of_week,
          start_time: scheduleForm.start_time,
          shares_national_slot: sharesNational,
          national_schedule_id: nationalScheduleId,
        },
      });
      toast.success("Horario agregado.");
      setScheduleConflict(null);
      setScheduleForm(emptySchedule);
      await openSchedule(scheduleLeague);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setScheduleSaving(false);
    }
  }

  function handleAddSchedule() {
    const conflict = findNationalConflict(scheduleForm);
    if (conflict) {
      setScheduleConflict(conflict);
      return;
    }
    submitSchedule(false, null);
  }

  async function handleDeleteSchedule(id: string) {
    if (!scheduleLeague) return;
    try {
      await deleteScheduleFn({ data: { schedule_id: id } });
      await openSchedule(scheduleLeague);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  }

  const scheduleLeagueList = leagueSchedules.filter((s) => s.league_id === scheduleLeague?.id);
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
                            <div className="flex items-center gap-2">
                              <Trophy size={14} className="text-primary" />
                              {l.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {l.start_date} — {l.end_date}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{l.store_league_tournaments.length}</td>
                          <td className="px-4 py-3 text-gray-300">{l.store_league_prizes.length}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openSchedule(l)}
                                className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
                              >
                                <Calendar size={12} />
                                Horarios
                              </button>
                              <button
                                onClick={() => openManage(l)}
                                className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
                              >
                                <Gift size={12} />
                                Torneos y premios
                              </button>
                              <button
                                onClick={() => setEditing({ ...l })}
                                className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
                              >
                                <Pencil size={12} />
                                Editar
                              </button>
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
                          <td className="px-4 py-3 text-white">{l.name}</td>
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

      {/* Editar liga */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar liga</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input
                    type="date"
                    value={editing.start_date}
                    onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input
                    type="date"
                    value={editing.end_date}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Días activos</Label>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAYS.map((d) => (
                    <label key={d.value} className="flex items-center gap-1.5 text-sm text-gray-300">
                      <Checkbox
                        checked={editing.active_weekdays.includes(d.value)}
                        onCheckedChange={() =>
                          setEditing({ ...editing, active_weekdays: toggleWeekday(editing.active_weekdays, d.value) })
                        }
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={editSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Torneos y premios */}
      <Dialog open={manageLeague !== null} onOpenChange={(o) => !o && setManageLeague(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{manageLeague?.name} — Torneos y premios</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Torneos que cuentan para esta liga</Label>
              {tournaments.length === 0 ? (
                <p className="text-xs text-gray-500">No hay torneos publicados en tu tienda todavía.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {tournaments.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-white/5">
                      <Checkbox
                        checked={manageTournamentIds.has(t.id)}
                        onCheckedChange={() =>
                          setManageTournamentIds((prev) => {
                            const next = new Set(prev);
                            next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                            return next;
                          })
                        }
                      />
                      <span className="flex-1">{t.game_name}</span>
                      <span className="text-xs text-gray-500">{t.tournament_date}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Premios y recompensas</Label>
                <button
                  type="button"
                  onClick={() => setManagePrizes((prev) => [...prev, { description: "", image_url: null }])}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Plus size={12} />
                  Agregar premio
                </button>
              </div>
              <div className="space-y-3">
                {managePrizes.map((p, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg border border-white/10 p-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-14 w-14 rounded object-cover" />
                    ) : (
                      <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded border border-dashed border-white/20 text-gray-500 hover:border-primary hover:text-primary">
                        {uploadingIdx === idx ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ImagePlus size={16} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePrizeImageUpload(idx, file);
                          }}
                        />
                      </label>
                    )}
                    <textarea
                      value={p.description}
                      onChange={(e) =>
                        setManagePrizes((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                      }
                      placeholder="Ej. 1er lugar: caja de sobres + playmat"
                      rows={2}
                      className="w-full flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setManagePrizes((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageLeague(null)} disabled={manageSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveManage} disabled={manageSaving}>
              {manageSaving ? <Loader2 className="animate-spin" size={16} /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Horarios de liga */}
      <Dialog
        open={scheduleLeague !== null}
        onOpenChange={(o) => {
          if (!o) {
            setScheduleLeague(null);
            setScheduleConflict(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{scheduleLeague?.name} — Horarios</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Horarios actuales</Label>
              {scheduleLeagueList.length === 0 ? (
                <p className="text-xs text-gray-500">Aún no hay horarios para esta liga.</p>
              ) : (
                <div className="space-y-1.5">
                  {scheduleLeagueList.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="text-white">{s.game_name}</span>{" "}
                        <span className="text-gray-400">
                          · {WEEKDAYS.find((d) => d.value === s.day_of_week)?.label} {s.start_time}
                        </span>
                        {s.shares_national_slot && (
                          <Badge variant="outline" className="ml-2 border-primary/40 text-primary">
                            comparte con circuito nacional
                          </Badge>
                        )}
                      </div>
                      <button onClick={() => handleDeleteSchedule(s.id)} className="text-gray-500 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <Label className="text-xs text-gray-400">Agregar horario</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select
                  value={scheduleForm.game_id}
                  onValueChange={(v) => setScheduleForm((f) => ({ ...f, game_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Juego" />
                  </SelectTrigger>
                  <SelectContent>
                    {gamesList.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(scheduleForm.day_of_week)}
                  onValueChange={(v) => setScheduleForm((f) => ({ ...f, day_of_week: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={scheduleForm.start_time}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>

              {scheduleConflict ? (
                <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <p className="text-amber-200">
                    Ya tienes un torneo del Circuito Nacional de{" "}
                    <strong>{scheduleConflict.game_name}</strong> los{" "}
                    {WEEKDAYS.find((d) => d.value === scheduleConflict.day_of_week)?.label} a las{" "}
                    {scheduleConflict.start_time}. ¿Los torneos de tu liga interna{" "}
                    <strong>{scheduleLeague?.name}</strong> son los mismos que los torneos del Circuito Nacional?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={scheduleSaving}
                      onClick={() => submitSchedule(true, scheduleConflict.id)}
                    >
                      Sí, son el mismo torneo
                    </Button>
                    <Button
                      size="sm"
                      disabled={scheduleSaving}
                      onClick={() => submitSchedule(false, null)}
                    >
                      No, crear torneo aparte
                    </Button>
                    <button
                      onClick={() => setScheduleConflict(null)}
                      className="ml-auto text-gray-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <Button size="sm" onClick={handleAddSchedule} disabled={scheduleSaving} className="gap-2">
                  {scheduleSaving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                  Agregar horario
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleLeague(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
