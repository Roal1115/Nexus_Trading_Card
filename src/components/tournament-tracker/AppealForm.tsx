import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { createAppeal } from "@/lib/geekarena-appeals.functions";
import { getDeckIdentifiers } from "@/lib/geekarena-tournament-tracker.functions";

type DeckIdentifier = {
  id: string;
  card_name: string;
  base_name: string;
  colors?: string[] | null;
  card_image: string | null;
  card_image_id?: string | null;
  set_code?: string | null;
  card_set_id?: string | null;
};

export function AppealForm({
  roundId,
  gameId,
  currentPlayerLeader,
  currentOpponentLeader,
  currentWonMatch,
  currentWonDieRoll,
  currentTurnOrder,
  onClose,
  onSubmitted,
}: {
  roundId: string;
  gameId: string;
  currentPlayerLeader: DeckIdentifier | null;
  currentOpponentLeader: DeckIdentifier | null;
  currentWonMatch: boolean | null;
  currentWonDieRoll: boolean | null;
  currentTurnOrder: "first" | "second" | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const submitAppeal = useServerFn(createAppeal);
  const [wonMatch, setWonMatch] = useState<boolean | null>(currentWonMatch);
  const [wonDieRoll, setWonDieRoll] = useState<boolean | null>(currentWonDieRoll);
  const [turnOrder, setTurnOrder] = useState<"first" | "second" | null>(currentTurnOrder);
  const [playerLeader, setPlayerLeader] = useState<DeckIdentifier | null>(currentPlayerLeader);
  const [opponentLeader, setOpponentLeader] = useState<DeckIdentifier | null>(currentOpponentLeader);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitAppeal({
        data: {
          round_id: roundId,
          proposed_player_leader_id: playerLeader?.id ?? null,
          proposed_opponent_leader_id: opponentLeader?.id ?? null,
          proposed_won_match: wonMatch,
          proposed_won_die_roll: wonDieRoll,
          proposed_turn_order: turnOrder,
        },
      });
      toast.success("Apelación enviada. El organizador de tu tienda la revisará.");
      onSubmitted();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al enviar la apelación");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-black/90 p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white">Apelar resultado</h3>
            <p className="mt-1 text-xs text-gray-400">
              Propón la información correcta. El organizador de tu tienda revisará ambas versiones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
                Tu leader
              </label>
              <LeaderQuickPicker gameId={gameId} value={playerLeader} onChange={setPlayerLeader} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
                Leader del oponente
              </label>
              <LeaderQuickPicker gameId={gameId} value={opponentLeader} onChange={setOpponentLeader} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
                ¿Quién ganó el dado?
              </label>
              <select
                value={wonDieRoll === null ? "" : wonDieRoll ? "me" : "opponent"}
                onChange={(e) => setWonDieRoll(e.target.value === "" ? null : e.target.value === "me")}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="">—</option>
                <option value="me">Yo</option>
                <option value="opponent">Oponente</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
                Tu turno
              </label>
              <select
                value={turnOrder ?? ""}
                onChange={(e) => setTurnOrder((e.target.value || null) as "first" | "second" | null)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="">—</option>
                <option value="first">Primero</option>
                <option value="second">Segundo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
              ¿Quién ganó el match?
            </label>
            <select
              value={wonMatch === null ? "" : wonMatch ? "me" : "opponent"}
              onChange={(e) => setWonMatch(e.target.value === "" ? null : e.target.value === "me")}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">—</option>
              <option value="me">Yo</option>
              <option value="opponent">Oponente</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-black disabled:opacity-50"
          >
            <Send size={14} />
            {submitting ? "Enviando…" : "Enviar apelación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaderQuickPicker({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: DeckIdentifier | null;
  onChange: (d: DeckIdentifier | null) => void;
}) {
  const fetchDeckIdentifiers = useServerFn(getDeckIdentifiers);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<DeckIdentifier[]>([]);
  const [open, setOpen] = useState(false);

  const handleSearch = (v: string) => {
    setSearch(v);
    setOpen(true);
    fetchDeckIdentifiers({ data: { game_id: gameId, search: v, basic_only: true } })
      .then((rows) => setOptions(rows as DeckIdentifier[]))
      .catch(() => setOptions([]));
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value ? value.base_name : search}
        onFocus={() => setOpen(true)}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar leader…"
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
      />
      {open && options.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-white/10 bg-[#1a1d29] shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
                setSearch("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white bg-transparent hover:bg-white/10"
            >
              {opt.card_image ? (
                <img src={opt.card_image} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="h-8 w-8 rounded bg-gray-700" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm">{opt.base_name}</p>
                {opt.card_set_id && (
                  <p className="text-[10px] text-gray-400">{opt.card_set_id}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
