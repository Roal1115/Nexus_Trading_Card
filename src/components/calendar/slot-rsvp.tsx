import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import {
  cancelSlotRsvp,
  createSlotRsvp,
  getMySlotRsvps,
  getMySlotsToLog,
  getSlotRsvpCount,
  getSlotRsvpList,
} from "@/lib/nexus-rsvp.functions";
import { RSVP_NOTICE, RSVP_WINDOW_DAYS, slotRsvpState } from "@/lib/rsvp-rules";
import { nowInMexicoTimeStr, todayInMexicoStr } from "@/lib/utils";

type Slot = { store_id: string; game_id: string; date: string };

const slotKey = (s: Slot) => `${s.store_id}_${s.game_id}_${s.date}`;

// Los horarios de liga interna no pasan por la app de Bandai.
export const acceptsSlotRsvp = (entry: {
  is_scheduled?: boolean;
  league_id?: string | null;
  cancellation_reason?: string | null;
}) => Boolean(entry.is_scheduled) && !entry.league_id && !entry.cancellation_reason;

export function useMySlotRsvps(playerId: string | undefined) {
  const fetchMine = useServerFn(getMySlotRsvps);
  const { data } = useQuery({
    queryKey: ["my-slot-rsvps", playerId],
    queryFn: () => fetchMine(),
    enabled: !!playerId,
  });
  return useMemo(
    () => ({
      has: (slot: Slot) =>
        (data?.slots ?? []).some(
          (s) => slotKey({ ...s, date: s.occurrence_date }) === slotKey(slot),
        ),
    }),
    [data],
  );
}

export function SlotRsvpPanel({
  entry,
  playerId,
}: {
  entry: Slot & { time?: string | null };
  playerId: string | undefined;
}) {
  const slot = { store_id: entry.store_id, game_id: entry.game_id, date: entry.date };
  const qc = useQueryClient();
  const mine = useMySlotRsvps(playerId);
  const attending = mine.has(slot);
  const fetchCount = useServerFn(getSlotRsvpCount);
  const createFn = useServerFn(createSlotRsvp);
  const cancelFn = useServerFn(cancelSlotRsvp);

  const { data: countData } = useQuery({
    queryKey: ["slot-rsvp-count", slotKey(slot)],
    queryFn: () => fetchCount({ data: slot }),
  });

  const toggle = useMutation({
    mutationFn: () => (attending ? cancelFn({ data: slot }) : createFn({ data: slot })),
    onSuccess: () => {
      toast.success(attending ? "Ya no aparece tu interés" : "Marcaste que te interesa ir");
      qc.invalidateQueries({ queryKey: ["slot-rsvp-count", slotKey(slot)] });
      qc.invalidateQueries({ queryKey: ["my-slot-rsvps", playerId] });
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar tu interés"),
  });

  const state = slotRsvpState({
    date: entry.date,
    startTime: entry.time,
    today: todayInMexicoStr(),
    nowTime: nowInMexicoTimeStr(),
  });
  const count = countData?.count ?? 0;

  // Solo se ofrece si sigue pendiente: ya registrada, Mis Partidas no tendría su tarjeta.
  const fetchToLog = useServerFn(getMySlotsToLog);
  const { data: toLog } = useQuery({
    queryKey: ["slots-to-log", playerId],
    queryFn: () => fetchToLog(),
    enabled: state === "started" && attending,
  });
  const canLog = toLog?.slots.some((s) => slotKey(s) === slotKey(slot));

  return (
    <div className="space-y-2">
      {count > 0 && (
        <p className="text-sm font-medium text-foreground">
          {count === 1 ? "1 persona quiere ir" : `${count} personas quieren ir`}
        </p>
      )}
      {state === "started" && canLog ? (
        <Link
          to="/sessions"
          className="block rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground"
        >
          Registrar mi partida
        </Link>
      ) : state !== "open" ? (
        <p className="text-sm text-foreground-secondary">
          {state === "started"
            ? "Este torneo ya empezó."
            : `Podrás marcar tu interés ${RSVP_WINDOW_DAYS} días antes del torneo.`}
        </p>
      ) : playerId ? (
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition disabled:opacity-60 ${
            attending
              ? "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <Heart size={15} className={attending ? "fill-current" : ""} />
          {attending ? "Te interesa ir · Quitar" : "Me interesa ir"}
        </button>
      ) : (
        <Link
          to="/login"
          className="block rounded-lg bg-primary py-3 text-center text-sm font-semibold text-primary-foreground"
        >
          Inicia sesión para marcar que te interesa
        </Link>
      )}
      {state === "open" && <p className="text-xs text-warning">{RSVP_NOTICE}</p>}
    </div>
  );
}

export function SlotRsvpList({ slot }: { slot: Slot }) {
  const fetchList = useServerFn(getSlotRsvpList);
  const { data, isLoading, error } = useQuery({
    queryKey: ["slot-rsvp-list", slotKey(slot)],
    queryFn: () =>
      fetchList({ data: { store_id: slot.store_id, game_id: slot.game_id, date: slot.date } }),
  });
  const players = data?.players ?? [];

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-xs uppercase text-foreground-subtle">
        Interesados en ir{players.length > 0 ? ` · ${players.length}` : ""}
      </div>
      {error ? (
        <p className="mt-1 text-sm text-red-300">No se pudo cargar la lista.</p>
      ) : isLoading ? (
        <p className="mt-1 text-sm text-foreground-secondary">Cargando…</p>
      ) : players.length === 0 ? (
        <p className="mt-1 text-sm text-foreground-secondary">Nadie ha marcado interés todavía.</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {players.map((p, i) => (
            <li key={p.id} className="flex items-baseline gap-2 text-sm text-foreground">
              <span className="w-5 text-right text-xs text-foreground-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{p.geek_tag}</span>
              <span className="text-xs text-foreground-secondary">{p.tcg_user_id ?? "Sin ID"}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-foreground-subtle">
        En orden de llegada. La inscripción oficial sigue siendo en la app de Bandai.
      </p>
    </div>
  );
}
