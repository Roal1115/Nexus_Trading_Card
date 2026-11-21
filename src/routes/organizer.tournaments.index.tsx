import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  BTN_OUTLINE,
  FOCUS_RING,
  InlineError,
  SURFACE,
  plural,
} from "@/components/stores/store-ui";
import { toast } from "sonner";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  deleteDraftTournament,
  getMyTournaments,
  getOrganizerFilterOptions,
  getOrganizerTournamentHistory,
} from "@/lib/nexus-organizer.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { TournamentStatusBadge } from "@/components/admin/TournamentStatusBadge";
import {
  TournamentHistory,
  TournamentListRow,
  TournamentListSkeleton,
  fmtDay,
  parseHistorySearch,
  type HistorySearch,
} from "@/components/admin/TournamentHistory";
import { tournamentsByTab, type OrganizerTab } from "@/components/organizer/organizer-home";

const TOURNAMENT_TABS = ["pending", "rejected", "approved", "published", "all"] as const;
type TournamentsTab = (typeof TOURNAMENT_TABS)[number];
type TournamentsSearch = HistorySearch & { tab?: TournamentsTab };

// Ruta índice (antes organizer.tournaments.tsx, que al ser padre de
// tournaments.$id sin <Outlet/> tapaba el detalle). La pestaña vive en ?tab=;
// los filtros de "Todos" también. Cambiar de pestaña los limpia.
export const Route = createFileRoute("/organizer/tournaments/")({
  validateSearch: (s: Record<string, unknown>): TournamentsSearch => ({
    ...parseHistorySearch(s),
    tab: TOURNAMENT_TABS.includes(s.tab as TournamentsTab) ? (s.tab as TournamentsTab) : undefined,
  }),
  head: () => ({ meta: [{ title: "Torneos — Organizador" }] }),
  component: TournamentsPage,
});

type Row = {
  id: string;
  game_id: string;
  game_name: string;
  tournament_date: string;
  status: string;
  csv_url: string | null;
  approved_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  critical_alerts?: number;
  rejection_reason?: string | null;
  approved_by_tag?: string | null;
  participants?: number;
};

// 44px de toque en móvil (como los botones del sistema); no se encogen para que la fila haga scroll.
const TAB_TRIGGER = "shrink-0 min-h-11 sm:min-h-9";

// Qué significa cada estado y qué sigue: un vacío no debe ser un callejón sin salida.
const EMPTY: Record<OrganizerTab, { text: string; hint: string; upload?: boolean }> = {
  pending: {
    text: "No tienes torneos en revisión.",
    hint: "Cuando subas uno, aparece aquí mientras el equipo lo revisa.",
    upload: true,
  },
  rejected: {
    text: "No tienes torneos rechazados.",
    hint: "Si a un torneo le falta algo, aquí verás el motivo y cómo corregirlo.",
  },
  approved: {
    text: "No tienes torneos aprobados esperando publicación.",
    hint: "Aquí aparecen los torneos aprobados hasta que se publican.",
  },
  published: {
    text: "Aún no tienes torneos publicados.",
    hint: "Aquí verás tus torneos una vez publicados.",
    upload: true,
  },
};

function TournamentsPage() {
  const { player } = useNexusRole();
  const { tab: tabParam, ...search } = Route.useSearch();
  const tab = tabParam ?? "all";
  const navigate = useNavigate();
  const setTab = (v: string) =>
    navigate({
      to: "/organizer/tournaments",
      search: v === "all" ? {} : { tab: v as TournamentsTab },
    });

  const fetchList = useServerFn(getMyTournaments);
  const removeDraft = useServerFn(deleteDraftTournament);
  const fetchHistory = useServerFn(getOrganizerTournamentHistory);
  const fetchFilterOptions = useServerFn(getOrganizerFilterOptions);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchList({ data: {} });
      setRows(res.tournaments as Row[]);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    if (player) void load();
  }, [player?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const byTab = useMemo(() => tournamentsByTab(rows), [rows]);

  const handleDelete = async (id: string) => {
    try {
      await removeDraft({ data: { tournament_id: id } });
      toast.success("Torneo eliminado");
      await load();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  const count = (t: OrganizerTab) => (loading ? "" : ` (${byTab[t].length})`);

  // Entrar por ?tab=published en móvil: la pestaña activa no debe quedar fuera de la fila.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[data-state="active"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
    // Con `loading`: al llegar los conteos "(5)" las pestañas se ensanchan y la activa se descentra.
  }, [tab, loading]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Torneos</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Los torneos que subiste y en qué punto de la revisión está cada uno.
          </p>
        </div>
        <Button asChild>
          <Link to="/organizer/new">
            <Plus size={14} className="mr-1" aria-hidden />
            Subir torneo
          </Link>
        </Button>
      </header>

      {/* Un rechazo es lo más urgente: se ve sin tener que abrir su pestaña. */}
      {!loading && !error && byTab.rejected.length > 0 && tab !== "rejected" && (
        <div className={`${SURFACE} flex flex-wrap items-center gap-3 p-4`}>
          <AlertTriangle size={16} aria-hidden className="shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            Tienes {plural(byTab.rejected.length, "torneo rechazado", "torneos rechazados")}. Revisa
            el motivo, elimínalo y vuelve a subir el archivo corregido.
          </p>
          <Button variant="outline" size="sm" onClick={() => setTab("rejected")}>
            Ver rechazados
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        {/* Una sola fila con scroll horizontal: partida en dos filas desiguales en móvil. */}
        <TabsList ref={tabsRef} className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className={TAB_TRIGGER}>
            Todos
          </TabsTrigger>
          <TabsTrigger value="pending" className={TAB_TRIGGER}>
            En revisión{count("pending")}
          </TabsTrigger>
          <TabsTrigger value="rejected" className={TAB_TRIGGER}>
            Rechazados{count("rejected")}
          </TabsTrigger>
          <TabsTrigger value="approved" className={TAB_TRIGGER}>
            Aprobados{count("approved")}
          </TabsTrigger>
          <TabsTrigger value="published" className={TAB_TRIGGER}>
            Publicados{count("published")}
          </TabsTrigger>
        </TabsList>

        {(["pending", "rejected", "approved", "published"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            {loading ? (
              <div className={`${SURFACE} overflow-hidden`}>
                <TournamentListSkeleton />
              </div>
            ) : error ? (
              <div className={`${SURFACE} p-6`}>
                <InlineError onRetry={() => void load()}>
                  No se pudieron cargar tus torneos: {error}
                </InlineError>
              </div>
            ) : byTab[t].length === 0 ? (
              <div className={`${SURFACE} space-y-3 p-6 text-sm`}>
                <p className="text-foreground">{EMPTY[t].text}</p>
                <p className="text-foreground-secondary">{EMPTY[t].hint}</p>
                {EMPTY[t].upload && (
                  <Link to="/organizer/new" className={BTN_OUTLINE}>
                    Subir torneo
                  </Link>
                )}
              </div>
            ) : t === "rejected" ? (
              <RejectedList rows={byTab[t]} onDelete={handleDelete} />
            ) : (
              <TournamentRows rows={byTab[t]} onDelete={handleDelete} />
            )}
          </TabsContent>
        ))}

        {/* TODOS (antes /organizer/history) */}
        <TabsContent value="all" className="mt-4">
          <TournamentHistory
            search={search}
            onSearch={(next) =>
              navigate({ to: "/organizer/tournaments", search: { ...next, tab: "all" } })
            }
            fetchHistory={(filters) => fetchHistory({ data: filters })}
            fetchOptions={() => fetchFilterOptions()}
            detailTo="/organizer/tournaments/$id"
            audience="uploader"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DeleteButton({
  id,
  onDelete,
  label,
  what,
}: {
  id: string;
  onDelete: (id: string) => void;
  label?: boolean;
  /** Qué torneo es ("One Piece Card Game del 18 nov"): el nombre accesible no puede ser igual en cada fila. */
  what: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Eliminar torneo ${what}`}
          className={label ? undefined : "min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"}
        >
          <Trash2 size={14} className={`text-destructive ${label ? "mr-1" : ""}`} aria-hidden />
          {label && "Eliminar"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este torneo?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Solo puedes eliminar torneos en revisión o rechazados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(id)}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Rechazados: el motivo y la única salida real (eliminar y volver a subir). */
function RejectedList({ rows, onDelete }: { rows: Row[]; onDelete: (id: string) => void }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className={`${SURFACE} space-y-3 p-4`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link
              to="/organizer/tournaments/$id"
              params={{ id: r.id }}
              className={`rounded text-sm font-semibold text-foreground hover:underline ${FOCUS_RING}`}
            >
              {r.game_name} · <span className="font-mono-stat">{fmtDay(r.tournament_date)}</span>
            </Link>
            <TournamentStatusBadge
              status={r.status}
              rejectionReason={r.rejection_reason}
              size="sm"
              audience="uploader"
            />
          </div>
          <div className="rounded-lg border border-border px-3 py-2 text-sm">
            <p className="font-medium text-foreground-secondary">Motivo del rechazo</p>
            <p className="mt-1 break-words text-foreground">{r.rejection_reason}</p>
          </div>
          <p className="text-sm text-foreground-secondary">
            Elimina este torneo y vuelve a subir el archivo corregido.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <DeleteButton
              id={r.id}
              onDelete={onDelete}
              label
              what={`${r.game_name} del ${fmtDay(r.tournament_date)}`}
            />
            <Button asChild size="sm" variant="outline">
              <Link to="/organizer/new">
                <Plus size={14} className="mr-1" aria-hidden />
                Subir torneo
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** En revisión, Aprobados y Publicados: la misma fila que "Todos"; eliminar solo en borradores. */
function TournamentRows({ rows, onDelete }: { rows: Row[]; onDelete: (id: string) => void }) {
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <TournamentListRow
            key={r.id}
            r={r}
            detailTo="/organizer/tournaments/$id"
            audience="uploader"
            trailing={
              r.status === "DRAFT" ? (
                <DeleteButton
                  id={r.id}
                  onDelete={onDelete}
                  what={`${r.game_name} del ${fmtDay(r.tournament_date)}`}
                />
              ) : null
            }
          />
        ))}
      </ul>
    </div>
  );
}
