import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Scale, ShieldQuestion, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getStoreAppeals, resolveAppeal } from "@/lib/nexus-appeals.functions";

export const Route = createFileRoute("/organizer/appeals")({
  head: () => ({ meta: [{ title: "Apelaciones — Nexus" }] }),
  component: OrganizerAppealsPage,
});

type LeaderRef = { id: string; base_name: string; card_image: string | null } | null;

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
  round_number: number;
  appellant_tag: string;
  reporter_tag: string;
  original: VersionInfo;
  proposed: VersionInfo;
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
  appellantTag,
  reporterTag,
}: {
  tag?: string;
  label: string;
  version: VersionInfo;
  appellantTag: string;
  reporterTag: string;
}) {
  const winnerTag =
    version.appellant_won === true ? appellantTag : version.appellant_won === false ? reporterTag : null;
  const winnerLeader =
    version.appellant_won === true
      ? version.appellant_leader
      : version.appellant_won === false
      ? version.reporter_leader
      : null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>

      {winnerTag && (
        <p className="mb-2 text-sm font-bold text-white">
          Ganador: <span className="text-emerald-400">{winnerTag}</span>
          {winnerLeader && <span className="text-gray-400"> ({winnerLeader.base_name})</span>}
        </p>
      )}

      <div className="flex items-center justify-center gap-2">
        <div className="text-center">
          <LeaderThumb leader={version.appellant_leader} />
          <p className="mt-1 text-[10px] text-gray-400">{appellantTag}</p>
        </div>
        <span className="text-xs text-gray-500">vs</span>
        <div className="text-center">
          <LeaderThumb leader={version.reporter_leader} />
          <p className="mt-1 text-[10px] text-gray-400">{reporterTag}</p>
        </div>
      </div>

      <div className="mt-2 space-y-1 border-t border-white/5 pt-2 text-xs text-gray-300">
        <p>
          Dado:{" "}
          <span className="text-white">
            {version.won_die_roll === null
              ? "—"
              : version.won_die_roll
              ? `Ganó ${appellantTag}`
              : `Ganó ${reporterTag}`}
          </span>
        </p>
        <p>
          Turno:{" "}
          <span className="text-white">
            {version.turn_order === "first"
              ? `${appellantTag} fue primero`
              : version.turn_order === "second"
              ? `${appellantTag} fue segundo`
              : "—"}
          </span>
        </p>
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
      <div className="mb-1 flex items-center gap-2">
        <Scale size={16} className="text-amber-400" />
        <p className="text-sm font-bold text-white">Ronda {appeal.round_number}</p>
        <span className="ml-auto text-xs text-gray-500">{appeal.tournament_date ?? "—"}</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Esta apelación es de <span className="font-semibold text-white">{appeal.appellant_tag}</span> contra{" "}
        <span className="font-semibold text-white">{appeal.reporter_tag}</span>
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <VersionColumn
          tag="original"
          label={`Original (reportada por ${appeal.reporter_tag})`}
          version={appeal.original}
          appellantTag={appeal.appellant_tag}
          reporterTag={appeal.reporter_tag}
        />
        <VersionColumn
          tag="proposed"
          label={`Propuesta (de ${appeal.appellant_tag})`}
          version={appeal.proposed}
          appellantTag={appeal.appellant_tag}
          reporterTag={appeal.reporter_tag}
        />
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
        <h1 className="text-2xl font-bold text-white">Nexus</h1>
        <p className="text-lg font-semibold text-white">Apelaciones de Resultados</p>
        <p className="mt-1 text-sm text-gray-400">
          Revisa las disputas de resultados reportados en tu tienda y decide cuál versión es correcta.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : appeals.length === 0 ? (
        <p className="text-sm text-gray-400">No hay apelaciones pendientes en tu tienda.</p>
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
