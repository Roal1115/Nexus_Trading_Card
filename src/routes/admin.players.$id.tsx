import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getPlayerDetail } from "@/lib/geekarena-admin.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/players/$id")({
  component: PlayerDetailPage,
});

type Detail = Awaited<ReturnType<typeof getPlayerDetail>>;

function PlayerDetailPage() {
  const { id } = Route.useParams();
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;
  const fetchDetail = useServerFn(getPlayerDetail);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    fetchDetail({ data: { player_id: id } })
      .then((r) => setData(r as Detail))
      .catch((e) => toast.error(String((e as Error).message ?? e)))
      .finally(() => setLoading(false));
  }, [email, id, fetchDetail]);

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/players">
          <ArrowLeft size={14} className="mr-1" /> Volver a jugadores
        </Link>
      </Button>

      <header className="glass rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Perfil de jugador
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">
              {data.player.geek_tag}
            </h1>
            {data.player.display_name && (
              <p className="text-sm text-gray-400">{data.player.display_name}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">{data.player.email ?? "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={data.player.role === "admin" ? "default" : "secondary"}>
              {data.player.role}
            </Badge>
            {data.player.is_active ? (
              <Badge className="bg-emerald-500/15 text-emerald-300">Activo</Badge>
            ) : (
              <Badge className="bg-red-500/15 text-red-300">Inactivo</Badge>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Torneos jugados" value={data.tournaments_played} />
        <Stat label="Torneos ganados" value={data.tournaments_won} />
        <Stat label="Puntos totales" value={data.total_points} />
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Tienda
        </h2>
        <p className="mt-2 text-white">
          {data.store ? data.store.name : "Sin tienda asignada"}
          {data.store?.city && (
            <span className="text-gray-500"> — {data.store.city}</span>
          )}
        </p>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
          <Trophy size={14} /> Historial de torneos
        </h2>
        {data.results.length === 0 ? (
          <p className="text-sm text-gray-500">Sin participaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Posición</th>
                  <th className="px-2 py-2">W-L</th>
                  <th className="px-2 py-2">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r, i) => {
                  const t = data.tournaments.find((x) => x.id === r.tournament_id);
                  return (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-2 py-2 text-gray-300">
                        {t?.tournament_date
                          ? new Date(t.tournament_date).toLocaleDateString("es-MX")
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-white">#{r.rank}</td>
                      <td className="px-2 py-2 text-gray-300">
                        {r.wins}-{r.losses}
                      </td>
                      <td className="px-2 py-2 text-primary">{r.points_earned}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.yearly_snapshots.length > 0 && (
        <section className="glass rounded-2xl p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Rankings anuales
          </h2>
          <div className="space-y-2">
            {data.yearly_snapshots.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-white/5 py-2 text-sm"
              >
                <span className="text-gray-300">{s.timeframe_value}</span>
                <span className="text-white">
                  #{s.rank_position} — {s.total_points} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">
        {value.toLocaleString("es-MX")}
      </p>
    </div>
  );
}
