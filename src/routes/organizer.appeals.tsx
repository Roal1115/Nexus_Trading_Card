import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Scale, ShieldQuestion, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getStoreAppeals, resolveAppeal } from "@/lib/geekarena-appeals.functions";

export const Route = createFileRoute("/organizer/appeals")({
  head: () => ({ meta: [{ title: "Apelaciones — Geek Arena" }] }),
  component: OrganizerAppealsPage,
});

type LeaderRef = { id: string; base_name: string; card_image: string | null } | null;

type AppealRow = {
  id: string;
  tournament_id: string;
  tournament_date: string | null;
  round_number: number;
  appellant_tag: string;
  original_reporter_tag: string;
  original: {
    player_leader: LeaderRef;
    opponent_leader: LeaderRef;
    won_match: boolean | null;
    won_die_roll: boolean | null;
    turn_order: "first" | "second" | null;
  };
  proposed: {
    player_leader: LeaderRef;
    opponent_leader: LeaderRef;
    won_match: boolean | null;
    won_die_roll: boolean | null;
    turn_order: "first" | "second" | null;
  };
  created_at: string;
};

function LeaderThumb({ leader }: { leader: LeaderRef }) {
  if (!leader) {
    return (
      <span className="inline-flex items-center rounded bg-white/5 px-2 py-1 text-xs text-gray-400">
        Sin líder
      </span>
    );
  }
  return leader.card_image ? (
    <img
      src={leader.card_image}
      alt={leader.base_name}
      className="h-8 w-auto rounded border border-white/10"
      loading="lazy"
    />
  ) : (
    <span className="inline-flex items-center rounded bg-white/5 px-2 py-1 text-xs text-gray-300">
      {leader.base_name}
    </span>
  );
}

function VersionColumn({
  label,
  version,
}: {
  label: string;
  version: AppealRow["original"];
}) {
  return (
    <div className="flex-1 rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
        {label}
      </div>

      <div className="mb-2 flex items-center gap-2 text-sm text-white">
        <LeaderThumb leader={version.player_leader} />
        <span className="text-gray-500">vs</span>
        <LeaderThumb leader={version.opponent_leader} />
      </div>

      <div className="space-y-1 text-xs text-gray-400">
        <div>
          Resultado:{" "}
          <span className="text-white">
            {version.won_match === true ? "Ganó" : version.won_match === false ? "Perdió" : "—"}
          </span>
        </div>

        <div>
          Dado: {version.won_die_roll === null ? "—" : version.won_die_roll ? "Sí" : "No"}
        </div>

        <div>
          Turno:{" "}
          <span className="text-white">
            {version.turn_order === "first" ? "Primero" : version.turn_order === "second" ? "Segundo" : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function AppealCard({ appeal, onResolved }: { appeal: AppealRow; onResolved: () => void }) {
  const resolve = useServerFn(resolveAppeal);
  const [resolving, setResolving] = useState(false);

  const handleResolve = async (resolution: "accepted_original" | "accepted_proposed") => {
    setResolving(true);
    try {
      await resolve({ data: { appeal_id: appeal.id, resolution } });
      toast.success("Apelación resuelta");
      onResolved();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al resolver la apelación");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-amber-400" />
          <span className="text-sm font-bold text-white">
            Ronda {appeal.round_number}
          </span>
          <span className="text-xs text-gray-500">
            {appeal.original_reporter_tag} vs {appeal.appellant_tag}
          </span>
        </div>

        <span className="text-xs text-gray-500">
          {appeal.tournament_date ?? "—"}
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <VersionColumn label="Original (reportada)" version={appeal.original} />
        <VersionColumn label="Propuesta (apelante)" version={appeal.proposed} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleResolve("accepted_original")}
          disabled={resolving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10 disabled:opacity-50"
        >
          <CheckCircle2 size={14} /> Aceptar original
        </button>
        <button
          onClick={() => handleResolve("accepted_proposed")}
          disabled={resolving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-500 py-2 text-xs font-bold uppercase tracking-widest text-black hover:bg-amber-400 disabled:opacity-50"
        >
          <ShieldQuestion size={14} /> Aceptar propuesta
        </button>
      </div>
    </div>
  );
}

function OrganizerAppealsPage() {
  const fetchAppeals = useServerFn(getStoreAppeals);
  const [loading, setLoading] = useState(true);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);

  const load = () => {
    setLoading(true);
    fetchAppeals()
      .then((res: any) => setAppeals(res.appeals ?? []))
      .catch(() => setAppeals([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Geek Arena</h1>
        <p className="text-lg font-semibold text-white">Apelaciones de Resultados</p>
        <p className="mt-1 text-sm text-gray-400">
          Revisa las disputas de resultados reportados en tu tienda y decide cuál versión es correcta.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : appeals.length === 0 ? (
        <p className="text-sm text-gray-400">
          No hay apelaciones pendientes en tu tienda.
        </p>
      ) : (
        <div className="space-y-4">
          {appeals.map((a) => (
            <AppealCard key={a.id} appeal={a} onResolved={load} />
          ))}
        </div>
      )}
    </div>
  );
}
