import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Store as StoreIcon,
  Gamepad2,
  Calendar,
  User,
  Upload,
  Users,
  ChevronRight,
} from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { toast } from "sonner";
import { getOrganizerTournamentDetail } from "@/lib/geekarena-organizer.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/organizer/tournaments/$id")({
  component: OrganizerTournamentDetailPage,
});

type Detail = Awaited<ReturnType<typeof getOrganizerTournamentDetail>>;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()} ${MESES[dt.getMonth()]} ${dt.getFullYear()}`;
}

function formatDateTime(iso: string) {
  const dt = new Date(iso);
  return `${dt.getDate()} ${MESES[dt.getMonth()]} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Borrador", cls: "bg-gray-500/20 text-gray-200 border-gray-400/30" },
    APPROVED: { label: "Aprobado", cls: "bg-yellow-500/20 text-yellow-200 border-yellow-400/40" },
    PUBLISHED: { label: "Publicado", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" },
  };
  const v = map[status] ?? { label: status, cls: "bg-white/10 text-white border-white/20" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${v.cls}`}>
      {v.label}
    </span>
  );
}

function OrganizerTournamentDetailPage() {
  const { id } = Route.useParams();
  const fetchDetail = useServerFn(getOrganizerTournamentDetail);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchDetail({ data: { tournament_id: id } });
        if (!cancelled) setData(res);
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const newPlayersCount = useMemo(
    () => (data?.results ?? []).filter((r) => r.is_new_player).length,
    [data],
  );

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const { tournament, store, game, uploaded_by, results, alerts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link to="/organizer/history" className="hover:text-primary">Historial de Torneos</Link>
          <ChevronRight size={12} />
          <span className="text-white">Detalle del Torneo</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/organizer/history"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={14} className="mr-1" /> Regresar
          </Link>
          {statusBadge(tournament.status)}
        </div>
      </header>

      {/* Resumen */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={<StoreIcon size={16} />}
          title="Tienda"
          main={store.name}
          sub={[store.city, store.state].filter(Boolean).join(", ") || "—"}
        />
        <SummaryCard icon={<Gamepad2 size={16} />} title="Juego" main={game.name} sub="" />
        <SummaryCard
          icon={<Calendar size={16} />}
          title="Fecha"
          main={formatDate(tournament.tournament_date)}
          sub={`Semestre ${tournament.qualifying_semester} ${tournament.qualifying_year}`}
        />
        <SummaryCard
          icon={<User size={16} />}
          title="Subido por"
          main={uploaded_by?.geek_tag ?? "—"}
          sub={uploaded_by?.email ?? ""}
        />
        <SummaryCard
          icon={<Upload size={16} />}
          title="Fecha de carga"
          main={tournament.created_at ? formatDateTime(tournament.created_at) : "—"}
          sub=""
        />
        <SummaryCard
          icon={<Users size={16} />}
          title="Participantes"
          main={`${results.length} jugadores`}
          sub={newPlayersCount > 0 ? `${newPlayersCount} nuevos` : ""}
        />
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <Upload size={16} /> Archivo de resultados
          </div>
          <div className="mt-2">
            <FileLink url={(tournament as any).csv_url} label="Descargar archivo" size="md" />
          </div>
        </div>
      </section>

      {/* Alertas (solo lectura) */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle size={16} className="text-primary" />
          Alertas del sistema
        </h2>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 size={14} /> Sin alertas — todo se ve bien
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                  a.level === "CRITICAL"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                }`}
              >
                <span className="mt-0.5">{a.level === "CRITICAL" ? "🔴" : "🟡"}</span>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Resultados */}
      <section className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Resultados del torneo</h2>
          <span className="text-xs text-gray-400">
            Total: {results.length} participantes
            {newPlayersCount > 0 ? ` · ${newPlayersCount} jugadores nuevos` : ""}
          </span>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Geek Tag</th>
                <th className="px-4 py-3">Match Pts</th>
                <th className="px-4 py-3">OMW%</th>
                <th className="px-4 py-3">Pts Arena</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.rank}-${r.geek_tag}`} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold text-white">{r.rank}</td>
                  <td className="px-4 py-3 text-gray-200">{r.geek_tag}</td>
                  <td className="px-4 py-3 text-gray-300">{r.match_points ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {typeof r.omw_percentage === "number" ? `${r.omw_percentage.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">{r.points_earned}</td>
                  <td className="px-4 py-3">
                    {r.is_new_player ? (
                      <Badge className="bg-orange-500/20 text-orange-200 border-orange-400/40">Nuevo</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40">Registrado</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Estado del torneo (sin acciones) */}
      <div className="flex justify-end">
        {statusBadge(tournament.status)}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  main,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  main: string;
  sub: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
        {icon} {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{main || "—"}</div>
      {sub ? <div className="text-xs text-gray-400">{sub}</div> : null}
    </div>
  );
}
