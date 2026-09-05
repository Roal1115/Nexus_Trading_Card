import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Gift,
  Loader2,
  Trash2,
  ImagePlus,
  Calendar,
  X,
  Save,
  ChevronRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getOrganizerOverview,
  listStoreLeagues,
  updateStoreLeague,
  archiveStoreLeague,
  setLeagueTournaments,
  setLeaguePrizes,
  listStoreTournamentsForLeagues,
  listLeagueScheduleData,
  createLeagueSchedule,
  deleteLeagueSchedule,
} from "@/lib/nexus-organizer.functions";

export const Route = createFileRoute("/organizer/leagues_/$leagueId")({
  component: OrganizerLeagueDetailPage,
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

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Prize = { description: string; image_url: string | null };
type League = {
  id: string;
  name: string;
  game_id: string | null;
  game_name: string | null;
  status: "active" | "archived";
  start_date: string;
  end_date: string;
  active_weekdays: number[];
  winner_player_id: string | null;
  winner_points: number | null;
  store_league_tournaments: { tournament_id: string }[];
  store_league_prizes: Array<{ id: string; description: string; image_url: string | null; sort_order: number }>;
};
type Tournament = { id: string; game_id: string; game_name: string; tournament_date: string; status: string };
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

function toggleWeekday(list: number[], day: number) {
  return list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort();
}

// Un torneo "pertenece" a la liga por defecto si cae dentro de su vigencia y
// coincide con uno de sus días activos — evita que el organizador tenga que
// marcar a mano cada torneo de una lista que solo crece.
function isWithinLeagueRange(t: Tournament, league: League) {
  if (t.tournament_date < league.start_date || t.tournament_date > league.end_date) return false;
  const dow = new Date(t.tournament_date + "T12:00:00").getDay();
  return league.active_weekdays.includes(dow);
}

const STEPS = [
  { id: "general", label: "General" },
  { id: "horarios", label: "Horarios" },
  { id: "torneos", label: "Torneos" },
  { id: "premios", label: "Premios" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function OrganizerLeagueDetailPage() {
  const { leagueId } = Route.useParams();

  const fetchOverview = useServerFn(getOrganizerOverview);
  const fetchLeagues = useServerFn(listStoreLeagues);
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
  const [league, setLeague] = useState<League | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [step, setStep] = useState<StepId>("general");

  // General
  const [generalForm, setGeneralForm] = useState({
    name: "",
    game_id: "",
    start_date: "",
    end_date: "",
    active_weekdays: [] as number[],
  });
  const [generalSaving, setGeneralSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Torneos
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<Set<string>>(new Set());
  const [tournamentsSaving, setTournamentsSaving] = useState(false);
  const [tournamentScope, setTournamentScope] = useState<"range" | "all">("range");

  // Premios
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [prizesSaving, setPrizesSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Horarios
  const [nationalSchedules, setNationalSchedules] = useState<NationalSchedule[]>([]);
  const [leagueSchedules, setLeagueSchedules] = useState<LeagueSchedule[]>([]);
  const [scheduleForm, setScheduleForm] = useState<NewScheduleForm>(emptySchedule);
  const [scheduleConflict, setScheduleConflict] = useState<NationalSchedule | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const refresh = async (sid: string) => {
    try {
      const [leaguesRes, tournamentsRes, scheduleRes]: any = await Promise.all([
        fetchLeagues({ data: { store_id: sid } }),
        fetchTournaments({ data: { store_id: sid } }),
        fetchScheduleData({ data: { store_id: sid } }),
      ]);
      const found: League | undefined = (leaguesRes.leagues ?? []).find((l: League) => l.id === leagueId);
      setLeague(found ?? null);
      const fetchedTournaments: Tournament[] = tournamentsRes.tournaments ?? [];
      if (found) {
        setGeneralForm({
          name: found.name,
          game_id: found.game_id ?? "",
          start_date: found.start_date,
          end_date: found.end_date,
          active_weekdays: found.active_weekdays,
        });
        const savedIds = new Set(found.store_league_tournaments.map((t) => t.tournament_id));
        setSelectedTournamentIds(
          savedIds.size > 0
            ? savedIds
            : new Set(fetchedTournaments.filter((t) => isWithinLeagueRange(t, found)).map((t) => t.id)),
        );
        setPrizes(
          [...found.store_league_prizes]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p) => ({ description: p.description, image_url: p.image_url })),
        );
      }
      setTournaments(fetchedTournaments);
      setNationalSchedules(scheduleRes.national_schedules ?? []);
      setLeagueSchedules(scheduleRes.league_schedules ?? []);
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
  }, [leagueId]);

  async function handleSaveGeneral() {
    if (!league || !storeId) return;
    if (
      !generalForm.name ||
      !generalForm.game_id ||
      !generalForm.start_date ||
      !generalForm.end_date ||
      generalForm.active_weekdays.length === 0
    ) {
      toast.error("Completa nombre, TCG, fechas y al menos un día activo.");
      return;
    }
    setGeneralSaving(true);
    try {
      await updateFn({ data: { league_id: league.id, ...generalForm } });
      toast.success("Liga actualizada.");
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setGeneralSaving(false);
    }
  }

  async function handleArchive() {
    if (!league || !storeId) return;
    if (!confirm("¿Archivar esta liga? Se calculará el ganador y no podrá editarse más.")) return;
    setArchiving(true);
    try {
      await archiveFn({ data: { league_id: league.id } });
      toast.success("Liga archivada.");
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setArchiving(false);
    }
  }

  async function handleSaveTournaments() {
    if (!league || !storeId) return;
    setTournamentsSaving(true);
    try {
      await setTournamentsFn({ data: { league_id: league.id, tournament_ids: Array.from(selectedTournamentIds) } });
      toast.success("Torneos actualizados.");
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setTournamentsSaving(false);
    }
  }

  async function handlePrizeImageUpload(idx: number, file: File) {
    if (!league) return;
    setUploadingIdx(idx);
    try {
      const path = `${league.id}/${Date.now()}-${file.name}`;
      const { error } = await nexus.storage.from("league-assets").upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      const { data } = nexus.storage.from("league-assets").getPublicUrl(path);
      setPrizes((prev) => prev.map((p, i) => (i === idx ? { ...p, image_url: data.publicUrl } : p)));
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setUploadingIdx(null);
    }
  }

  async function handleSavePrizes() {
    if (!league || !storeId) return;
    setPrizesSaving(true);
    try {
      await setPrizesFn({
        data: { league_id: league.id, prizes: prizes.filter((p) => p.description.trim().length > 0) },
      });
      toast.success("Premios actualizados.");
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setPrizesSaving(false);
    }
  }

  function findNationalConflict(form: NewScheduleForm) {
    return nationalSchedules.find((s) => s.game_id === form.game_id && s.day_of_week === form.day_of_week) ?? null;
  }

  async function submitSchedule(sharesNational: boolean, nationalScheduleId: string | null) {
    if (!league || !scheduleForm.game_id || !storeId) {
      toast.error("Elige un juego.");
      return;
    }
    setScheduleSaving(true);
    try {
      await createScheduleFn({
        data: {
          league_id: league.id,
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
      await refresh(storeId);
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
    if (!storeId) return;
    try {
      await deleteScheduleFn({ data: { schedule_id: id } });
      await refresh(storeId);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  }

  const scheduleLeagueList = leagueSchedules.filter((s) => s.league_id === leagueId);
  const isArchived = league?.status === "archived";
  const todayStr = new Date().toISOString().slice(0, 10);

  const visibleTournaments = useMemo(() => {
    // Una liga es de un solo TCG — la lista de torneos elegibles se filtra
    // por game_id, no por texto (antes había que "buscar por juego" a mano
    // en una lista mezclada de todos los TCG de la tienda).
    return tournaments.filter((t) => {
      if (league?.game_id && t.game_id !== league.game_id) return false;
      if (tournamentScope === "range" && league && !isWithinLeagueRange(t, league)) return false;
      return true;
    });
  }, [tournaments, tournamentScope, league]);

  const tournamentGroups = useMemo(() => {
    const groups = new Map<string, Tournament[]>();
    for (const t of visibleTournaments) {
      const key = t.tournament_date.slice(0, 7); // YYYY-MM
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [visibleTournaments]);

  function monthLabel(key: string) {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLine width="w-32" height="h-4" />
        <SkeletonLine width="w-64" height="h-8" />
        <div className="flex gap-6">
          <SkeletonBlock className="h-64 w-44 rounded-2xl" />
          <SkeletonBlock className="h-64 flex-1 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="space-y-4">
        <Link to="/organizer/leagues" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <ArrowLeft size={14} /> Volver a ligas
        </Link>
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">Liga no encontrada.</div>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const nextStep = STEPS[stepIndex + 1];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/organizer/leagues" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <ArrowLeft size={14} /> Volver a ligas
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-white">{league.name}</h1>
          <Badge variant="outline" className={isArchived ? "border-gray-500/40 text-gray-400" : "border-primary/40 text-primary"}>
            {isArchived ? "Archivada" : "Activa"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          {league.start_date} — {league.end_date}
        </p>
      </div>

      {isArchived && (
        <div className="glass rounded-2xl p-4 text-sm text-gray-400">
          Esta liga está archivada y no puede editarse. Ganador:{" "}
          {league.winner_player_id ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-300">
              {league.winner_player_id} — {league.winner_points ?? 0} pts
            </Badge>
          ) : (
            "sin resultados"
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Rail numerado — cada paso es clickeable en cualquier momento, no
            solo en orden; "Siguiente" abajo de cada sección solo guía la
            primera pasada. */}
        <nav className="flex gap-2 overflow-x-auto md:w-44 md:flex-none md:flex-col md:gap-1 md:overflow-visible">
          {STEPS.map((s, i) => {
            const isActive = s.id === step;
            const isDone = i < stepIndex;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition md:shrink",
                  isActive ? "bg-primary/15 text-primary" : "text-gray-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    isActive
                      ? "bg-primary text-black"
                      : isDone
                        ? "bg-primary/20 text-primary"
                        : "bg-white/10 text-gray-400",
                  )}
                >
                  {isDone ? <Check size={12} /> : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="glass min-w-0 flex-1 space-y-4 rounded-2xl p-6">
          {/* General */}
          {step === "general" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={generalForm.name}
                  disabled={isArchived}
                  onChange={(e) => setGeneralForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>TCG (juego)</Label>
                <Select
                  value={generalForm.game_id}
                  onValueChange={(v) => setGeneralForm((f) => ({ ...f, game_id: v }))}
                  disabled={isArchived}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un TCG" />
                  </SelectTrigger>
                  <SelectContent>
                    {gamesList.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {generalForm.game_id !== (league.game_id ?? "") && (
                  <p className="text-xs text-amber-400">
                    Cambiar el TCG desmarca todos los torneos ya seleccionados para esta liga.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input
                    type="date"
                    value={generalForm.start_date}
                    disabled={isArchived}
                    onChange={(e) => setGeneralForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input
                    type="date"
                    value={generalForm.end_date}
                    disabled={isArchived}
                    onChange={(e) => setGeneralForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Días activos</Label>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAYS.map((d) => (
                    <label key={d.value} className="flex items-center gap-1.5 text-sm text-gray-300">
                      <Checkbox
                        checked={generalForm.active_weekdays.includes(d.value)}
                        disabled={isArchived}
                        onCheckedChange={() =>
                          setGeneralForm((f) => ({ ...f, active_weekdays: toggleWeekday(f.active_weekdays, d.value) }))
                        }
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={handleArchive}
                  disabled={isArchived || archiving}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-40 sm:w-auto sm:justify-start"
                >
                  {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                  Archivar liga
                </button>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button onClick={handleSaveGeneral} disabled={isArchived || generalSaving} className="w-full gap-2 sm:w-auto">
                    {generalSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Guardar
                  </Button>
                  {nextStep && (
                    <Button variant="outline" onClick={() => setStep(nextStep.id)} className="w-full gap-1 sm:w-auto">
                      Siguiente: {nextStep.label} <ChevronRight size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Horarios */}
          {step === "horarios" && (
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
                        {!isArchived && (
                          <button onClick={() => handleDeleteSchedule(s.id)} className="text-gray-500 hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isArchived && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <Label className="text-xs text-gray-400">Agregar horario</Label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Select value={scheduleForm.game_id} onValueChange={(v) => setScheduleForm((f) => ({ ...f, game_id: v }))}>
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
                        Ya tienes un torneo del Circuito Nacional de <strong>{scheduleConflict.game_name}</strong> los{" "}
                        {WEEKDAYS.find((d) => d.value === scheduleConflict.day_of_week)?.label} a las{" "}
                        {scheduleConflict.start_time}. ¿Los torneos de tu liga interna <strong>{league.name}</strong> son
                        los mismos que los torneos del Circuito Nacional?
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
                        <Button size="sm" disabled={scheduleSaving} onClick={() => submitSchedule(false, null)}>
                          No, crear torneo aparte
                        </Button>
                        <button onClick={() => setScheduleConflict(null)} className="ml-auto text-gray-500 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" onClick={handleAddSchedule} disabled={scheduleSaving} className="gap-2">
                      {scheduleSaving ? <Loader2 className="animate-spin" size={14} /> : <Calendar size={14} />}
                      Agregar horario
                    </Button>
                  )}
                </div>
              )}

              {nextStep && (
                <div className="flex justify-end border-t border-white/10 pt-4">
                  <Button variant="outline" onClick={() => setStep(nextStep.id)} className="w-full gap-1 sm:w-auto">
                    Siguiente: {nextStep.label} <ChevronRight size={14} />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Torneos */}
          {step === "torneos" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Torneos que cuentan para esta liga</Label>
                <span className="text-xs text-gray-500">{selectedTournamentIds.size} seleccionados</span>
              </div>
              <p className="text-xs text-gray-500">
                Se preseleccionan automáticamente los torneos dentro de la vigencia y días activos de la liga
                ({league.start_date} — {league.end_date}). Desmarca las excepciones.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-white/10 p-0.5 text-xs">
                  <button
                    onClick={() => setTournamentScope("range")}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 font-semibold transition",
                      tournamentScope === "range" ? "bg-primary/20 text-primary" : "text-gray-400 hover:text-white",
                    )}
                  >
                    En rango de la liga
                  </button>
                  <button
                    onClick={() => setTournamentScope("all")}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 font-semibold transition",
                      tournamentScope === "all" ? "bg-primary/20 text-primary" : "text-gray-400 hover:text-white",
                    )}
                  >
                    Todos
                  </button>
                </div>
              </div>

              {tournaments.length === 0 ? (
                <p className="text-xs text-gray-500">No hay torneos publicados en tu tienda todavía.</p>
              ) : tournamentGroups.length === 0 ? (
                <p className="text-xs text-gray-500">No hay torneos que coincidan con este filtro.</p>
              ) : (
                <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {tournamentGroups.map(([monthKey, monthTournaments]) => (
                    <details key={monthKey} open className="rounded-lg">
                      <summary className="cursor-pointer select-none rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:bg-white/5">
                        {monthLabel(monthKey)} · {monthTournaments.length}
                      </summary>
                      <div className="mt-1 space-y-1">
                        {monthTournaments.map((t) => {
                          const isPast = t.tournament_date < todayStr;
                          return (
                            <label
                              key={t.id}
                              className={cn(
                                "flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white/5",
                                isPast ? "text-gray-500" : "text-gray-200",
                              )}
                            >
                              <Checkbox
                                checked={selectedTournamentIds.has(t.id)}
                                disabled={isArchived}
                                onCheckedChange={() =>
                                  setSelectedTournamentIds((prev) => {
                                    const next = new Set(prev);
                                    next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                                    return next;
                                  })
                                }
                              />
                              <span className="flex-1">{t.game_name}</span>
                              <span className="text-xs text-gray-500">{t.tournament_date}</span>
                              {isPast && (
                                <Badge variant="outline" className="border-white/10 text-[10px] text-gray-500">
                                  pasado
                                </Badge>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button onClick={handleSaveTournaments} disabled={isArchived || tournamentsSaving} className="w-full gap-2 sm:w-auto">
                  {tournamentsSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Guardar
                </Button>
                {nextStep && (
                  <Button variant="outline" onClick={() => setStep(nextStep.id)} className="w-full gap-1 sm:w-auto">
                    Siguiente: {nextStep.label} <ChevronRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Premios */}
          {step === "premios" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Premios y recompensas</Label>
                {!isArchived && (
                  <button
                    type="button"
                    onClick={() => setPrizes((prev) => [...prev, { description: "", image_url: null }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Gift size={12} />
                    Agregar premio
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {prizes.length === 0 ? (
                  <p className="text-xs text-gray-500">Aún no hay premios configurados.</p>
                ) : (
                  prizes.map((p, idx) => (
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
                            disabled={isArchived}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePrizeImageUpload(idx, file);
                            }}
                          />
                        </label>
                      )}
                      <textarea
                        value={p.description}
                        disabled={isArchived}
                        onChange={(e) =>
                          setPrizes((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                        }
                        placeholder="Ej. 1er lugar: caja de sobres + playmat"
                        rows={2}
                        className="w-full flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                      />
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => setPrizes((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end border-t border-white/10 pt-4">
                <Button onClick={handleSavePrizes} disabled={isArchived || prizesSaving} className="w-full gap-2 sm:w-auto">
                  {prizesSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
