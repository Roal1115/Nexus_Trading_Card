import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { errMsg, formatDate } from "@/components/panel/dashboard-format";
import { LoadError } from "@/components/panel/dashboard";
import { Button } from "@/components/ui/button";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import { getOrganizerPlayerDetail } from "@/lib/nexus-organizer.functions";

export const Route = createFileRoute("/organizer/players_/$playerId")({
  head: () => ({ meta: [{ title: "Jugador — Nexus" }] }),
  component: OrganizerPlayerDetailPage,
});

type Detail = Awaited<ReturnType<typeof getOrganizerPlayerDetail>>;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function OrganizerPlayerDetailPage() {
  const { playerId } = Route.useParams();
  const fetchDetail = useServerFn(getOrganizerPlayerDetail);

  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoadError(null);
    fetchDetail({ data: { player_id: playerId } })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, attempt]);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/organizer/players">
        <ArrowLeft size={14} className="mr-1" aria-hidden /> Jugadores
      </Link>
    </Button>
  );

  if (loadError) {
    return (
      <div className="space-y-3">
        {back}
        <div className="glass rounded-2xl">
          <LoadError message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {back}
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {back}
      <header>
        <h1 className="break-words text-3xl font-bold text-white">{data.geek_tag}</h1>
        <p className="mt-1 text-sm text-gray-400">Lo que ha jugado en tu tienda.</p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Torneos" value={data.tournaments.length} />
        <Stat label="Puntos" value={data.total_points} />
        <Stat label="Última visita" value={formatDate(data.last_visit)} />
      </section>

      <section aria-labelledby="player-tournaments">
        <h2 id="player-tournaments" className="mb-2 text-sm font-semibold text-white">
          Torneos
        </h2>
        <ul className="glass overflow-hidden rounded-2xl">
          {data.tournaments.map((t) => (
            <li key={t.id} className="border-t border-white/5 first:border-t-0">
              <Link
                to="/organizer/tournaments/$id"
                params={{ id: t.id }}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{t.game}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(t.date)} · Lugar {t.rank} · {t.points} pts
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
