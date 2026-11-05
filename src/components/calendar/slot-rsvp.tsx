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
export const acceptsSlotRsvp = (entry: { is_scheduled?: boolean; league_id?: string | null }) =>
  Boolean(entry.is_scheduled) && !entry.league_id;

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
      toast.success(attending ? "Quitaste tu preferencia" : "Preferencia registrada");
      qc.invalidateQueries({ queryKey: ["slot-rsvp-count", slotKey(slot)] });
      qc.invalidateQueries({ queryKey: ["my-slot-rsvps", playerId] });
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar tu preferencia"),
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
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-semibold text-white">
        {count === 1 ? "1 jugador" : `${count} jugadores`} con preferencia
      </p>
      {state === "started" && canLog ? (
        <Link
          to="/sessions"
          className="mt-2 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground"
        >
          Registrar mi partida
        </Link>
      ) : state !== "open" ? (
        <p className="mt-2 text-sm text-secondary-foreground">
          {state === "started"
            ? "Este torneo ya empezó."
            : `La preferencia abre ${RSVP_WINDOW_DAYS} días antes del torneo.`}
        </p>
      ) : playerId ? (
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
            attending
              ? "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <Heart size={15} className={attending ? "fill-current" : ""} />
          {attending ? "Quitar preferencia" : "Pedir preferencia"}
        </button>
      ) : (
        <Link
          to="/login"
          className="mt-2 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground"
        >
          Inicia sesión para pedir preferencia
        </Link>
      )}
      <p className="mt-2 text-xs text-secondary-foreground">{RSVP_NOTICE}</p>
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
      <div className="text-[10px] uppercase text-gray-500">
        Preferencia de jugadores{players.length > 0 ? ` · ${players.length}` : ""}
      </div>
      {error ? (
        <p className="mt-1 text-sm text-red-300">No se pudo cargar la lista.</p>
      ) : isLoading ? (
        <p className="mt-1 text-sm text-gray-400">Cargando…</p>
      ) : players.length === 0 ? (
        <p className="mt-1 text-sm text-gray-400">Nadie ha pedido preferencia todavía.</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {players.map((p, i) => (
            <li key={p.id} className="flex items-baseline gap-2 text-sm text-white">
              <span className="w-5 text-right text-xs text-gray-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{p.geek_tag}</span>
              <span className="text-xs text-gray-400">{p.tcg_user_id ?? "Sin ID"}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-gray-500">
        En orden de llegada. La inscripción oficial sigue siendo en la app de Bandai.
      </p>
    </div>
  );
}
