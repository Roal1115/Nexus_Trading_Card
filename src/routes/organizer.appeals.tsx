import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Loading } from "@/components/panel/dashboard";
import { ColorDots } from "@/components/tournament-tracker/color-dots";
import { cleanLeaderName } from "@/components/tournament-tracker/round-ui";
import { ago, fmtTournamentDate } from "@/components/panel/dashboard-format";
import { BTN_OUTLINE, FOCUS_RING, InlineError, SURFACE } from "@/components/stores/store-ui";
import { refreshBadges } from "@/hooks/use-badge-counts";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { deleteAppeal, getStoreAppeals, resolveAppeal } from "@/lib/nexus-appeals.functions";

export const Route = createFileRoute("/organizer/appeals")({
  head: () => ({ meta: [{ title: "Apelaciones — Nexus" }] }),
  component: OrganizerAppealsPage,
});

type LeaderRef = {
  id: string;
  base_name: string;
  card_image: string | null;
  colors: string[] | null;
  card_set_id: string | null;
  card_image_id: string | null;
} | null;

type VersionInfo = {
  appellant_leader: LeaderRef;
  reporter_leader: LeaderRef;
  appellant_won: boolean | null;
  won_die_roll: boolean | null;
  turn_order: "first" | "second" | null;
};

type AppealRow = {
  id: string;
  tournament_id: string;
  tournament_date: string | null;
  game_name: string | null;
  round_number: number;
  appellant_tag: string;
  reporter_tag: string;
  original: VersionInfo;
  proposed: VersionInfo;
  created_at: string;
};

// `key` decide si una versión cambió; `leader` (si lo hay) pone la carta junto al nombre.
type Cell = { key: string; text: string; leader?: LeaderRef };
type Row = { label: string; original: Cell; proposed: Cell };

const textCell = (text: string): Cell => ({ key: text, text });
// Hay líderes con exactamente el mismo nombre: se compara por id y se muestra la carta.
const leaderCell = (leader: LeaderRef): Cell => ({
  key: leader?.id ?? "",
  text: leader ? cleanLeaderName(leader.base_name) : "Sin líder",
  leader,
});

/** Una fila por dato, con cada versión, para ver de un vistazo qué cambia. */
function compareRows(a: AppealRow): Row[] {
  const A = a.appellant_tag;
  const R = a.reporter_tag;
  const rows: [string, (v: VersionInfo) => Cell][] = [
    ["Ganador", (v) => textCell(v.appellant_won === null ? "—" : v.appellant_won ? A : R)],
    [`Líder de ${A}`, (v) => leaderCell(v.appellant_leader)],
    [`Líder de ${R}`, (v) => leaderCell(v.reporter_leader)],
    ["Dado", (v) => textCell(v.won_die_roll === null ? "—" : `Ganó ${v.won_die_roll ? A : R}`)],
    [
      "Turno",
      (v) =>
        textCell(
          v.turn_order === null
            ? "—"
            : `${A} fue ${v.turn_order === "first" ? "primero" : "segundo"}`,
        ),
    ],
  ];
  return rows.map(([label, get]) => ({
    label,
    original: get(a.original),
    proposed: get(a.proposed),
  }));
}

/** Valor de una celda; un líder lleva su carta (5:7), nombre, ID de la carta y colores, como en el resto de la app. */
function CellView({ cell }: { cell: Cell }) {
  const art = cell.leader?.card_image;
  const code = cell.leader?.card_image_id ?? cell.leader?.card_set_id;
  return (
    <span className="flex min-w-0 items-start gap-2">
      {art && (
        <img
          src={art}
          alt=""
          width={44}
          height={62}
          loading="lazy"
          className="h-[62px] w-11 shrink-0 rounded border border-border object-cover"
        />
      )}
      <span className="min-w-0">
        <span className="block break-words">{cell.text}</span>
        {cell.leader && (code || cell.leader.colors?.length) && (
          <span className="mt-0.5 flex flex-wrap items-center text-xs text-foreground-secondary">
            {code && <span className="break-all font-mono">{code}</span>}
            <ColorDots colors={cell.leader.colors} />
          </span>
        )}
      </span>
    </span>
  );
}

// Contorno de advertencia para la acción que cambia lo registrado (DESIGN.md); nunca un bloque sólido.
const BTN_WARN = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-warning/50 px-3 text-sm font-semibold text-warning transition hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 ${FOCUS_RING}`;

function AppealCard({ appeal, onDone }: { appeal: AppealRow; onDone: (id: string) => void }) {
  const resolve = useServerFn(resolveAppeal);
  const remove = useServerFn(deleteAppeal);
  const [busy, setBusy] = useState(false);

  const { round_number: n, appellant_tag: A, reporter_tag: R } = appeal;
  const rows = compareRows(appeal);
  const changes = rows.filter((r) => r.original.key !== r.proposed.key);
  const titleId = `appeal-${appeal.id}`;
  const meta = [
    appeal.game_name,
    appeal.tournament_date && fmtTournamentDate(appeal.tournament_date),
    `apelada ${ago(appeal.created_at, new Date())}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onDone(appeal.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fail);
      setBusy(false);
    }
  };

  const keepOriginal = () =>
    run(
      () => resolve({ data: { appeal_id: appeal.id, resolution: "accepted_original" } }),
      `Ronda ${n}: se mantiene el resultado de ${R}`,
      "Error al resolver la apelación",
    );
  const applyProposal = () =>
    run(
      () => resolve({ data: { appeal_id: appeal.id, resolution: "accepted_proposed" } }),
      `Ronda ${n}: resultado cambiado a la propuesta de ${A}`,
      "Error al resolver la apelación",
    );
  const deleteIt = () =>
    run(
      () => remove({ data: { appeal_id: appeal.id } }),
      "Apelación eliminada",
      "Error al eliminar la apelación",
    );

  return (
    <li className={`${SURFACE} p-4 sm:p-5`}>
      <h2 id={titleId} className="break-words text-lg font-semibold text-foreground">
        Ronda <span className="font-mono-stat">{n}</span> · {A} contra {R}
      </h2>
      <p className="mt-1 text-sm text-foreground-secondary">
        {meta} ·{" "}
        <Link
          to="/organizer/tournaments/$id"
          params={{ id: appeal.tournament_id }}
          className={`rounded underline underline-offset-2 hover:text-foreground ${FOCUS_RING}`}
        >
          Ver torneo
        </Link>
      </p>

      {changes.length === 0 && (
        <p className="mt-3 text-sm text-foreground-secondary">
          La propuesta no cambia nada de lo que reportó {R}.
        </p>
      )}

      <table className="mt-3 w-full text-left text-sm">
        <caption className="sr-only">
          Ronda {n}: lo reportado por {R} frente a la propuesta de {A}
        </caption>
        <thead>
          <tr className="text-xs text-foreground-subtle">
            <th scope="col" className="py-2 pr-3 font-medium">
              <span className="sr-only">Dato</span>
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Original
              <span className="block break-words font-normal">reportada por {R}</span>
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Propuesta
              <span className="block break-words font-normal">de {A}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const changed = r.original.key !== r.proposed.key;
            return (
              <tr key={r.label} className="border-t border-border align-top">
                <th
                  scope="row"
                  className="break-words py-2 pr-3 font-normal text-foreground-secondary"
                >
                  {r.label}
                </th>
                <td
                  className={`break-words px-3 py-2 ${changed ? "text-foreground" : "text-foreground-subtle"}`}
                >
                  <CellView cell={r.original} />
                </td>
                <td
                  className={`break-words px-3 py-2 ${changed ? "font-semibold text-foreground" : "text-foreground-subtle"}`}
                >
                  <CellView cell={r.proposed} />
                  {changed && (
                    <span className="mt-1 block text-xs font-semibold text-warning">Cambia</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={keepOriginal}
          disabled={busy}
          aria-label={`Ronda ${n}: mantener el resultado original de ${R}`}
          className={`${BTN_OUTLINE} flex-1 sm:flex-none`}
        >
          <CheckCircle2 size={14} aria-hidden /> Mantener original
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={busy}
              aria-label={`Ronda ${n}: cambiar el resultado a la propuesta de ${A}`}
              className={`${BTN_WARN} flex-1 sm:flex-none`}
            >
              Cambiar resultado
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl border-border bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                ¿Cambiar el resultado de la Ronda {n}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foreground-secondary">
                Se reemplaza lo que reportó {R} por la propuesta de {A} y la apelación queda
                resuelta.
              </AlertDialogDescription>
              {changes.length > 0 && (
                <ul className="space-y-3 text-left text-sm text-foreground">
                  {changes.map((c) => (
                    <li key={c.label}>
                      <span className="text-foreground-secondary">{c.label}</span>
                      <span className="mt-1 flex items-start gap-2">
                        <CellView cell={c.original} />
                        <span aria-hidden className="text-foreground-subtle">
                          →
                        </span>
                        <CellView cell={c.proposed} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={busy} className={BTN_WARN} onClick={applyProposal}>
                Cambiar resultado
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={busy}
              aria-label={`Ronda ${n}: eliminar la apelación de ${A}`}
              className={`ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 ${FOCUS_RING}`}
            >
              <Trash2 size={14} aria-hidden /> Eliminar
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl border-border bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                ¿Eliminar esta apelación?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foreground-secondary">
                Se elimina la apelación de {A} en la Ronda {n}. La ronda vuelve a como estaba antes
                de apelar. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={deleteIt}
              >
                Eliminar apelación
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; appeals: AppealRow[] };

function OrganizerAppealsPage() {
  const fetchAppeals = useServerFn(getStoreAppeals);
  const { player } = useNexusRole();
  const [state, setState] = useState<State>({ status: "loading" });

  const load = () => {
    setState({ status: "loading" });
    fetchAppeals()
      .then((res) => setState({ status: "ok", appeals: res.appeals as AppealRow[] }))
      .catch((e) =>
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Revisa tu conexión.",
        }),
      );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se quita la tarjeta resuelta sin recargar la lista: no se pierde el lugar, y el sidebar recuenta.
  const done = (id: string) => {
    setState((s) =>
      s.status === "ok" ? { status: "ok", appeals: s.appeals.filter((a) => a.id !== id) } : s,
    );
    refreshBadges();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Apelaciones</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Revisa las disputas de resultados reportados en tu tienda y decide cuál versión es
          correcta.
        </p>
      </div>

      {player && !player.home_store_id ? (
        <div className={`${SURFACE} px-5 py-6 text-sm text-foreground-secondary`}>
          No tienes una tienda asignada, por eso no te llegan apelaciones. Contacta al
          administrador.
        </div>
      ) : state.status === "loading" ? (
        <div role="status">
          <Loading className="py-2" />
        </div>
      ) : state.status === "error" ? (
        <InlineError onRetry={load}>
          No se pudieron cargar las apelaciones: {state.message}
        </InlineError>
      ) : state.appeals.length === 0 ? (
        <div className={`${SURFACE} px-5 py-6`}>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 size={16} className="text-success" aria-hidden /> No hay apelaciones
            pendientes
          </p>
          <p className="mt-1 text-sm text-foreground-secondary">
            Aparecen aquí cuando un jugador disputa el resultado de una ronda de tu tienda.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {state.appeals.map((a) => (
            <AppealCard key={a.id} appeal={a} onDone={done} />
          ))}
        </ul>
      )}
    </div>
  );
}
