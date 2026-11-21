// Piezas compartidas del detalle de torneo (admin, TCG manager, organizer). Cada
// panel conserva sus acciones; aquí solo vive lo que se ve igual en los tres.
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Gamepad2,
  Store as StoreIcon,
  Upload,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileLink } from "@/components/ui/FileLink";
import {
  SkeletonBlock,
  SkeletonLine,
  TournamentRowSkeleton,
} from "@/components/ui/skeleton-loader";
import { SECTION, SURFACE, plural } from "@/components/stores/store-ui";
import { LoadError } from "./dashboard";
import { formatDate, formatDateTime } from "./dashboard-format";

type TournamentsPath = "/admin/tournaments" | "/tcg-manager/tournaments" | "/organizer/tournaments";

type ResultRow = {
  rank: number;
  geek_tag: string;
  match_points: number | null;
  omw_percentage: number | null;
  points_earned: number;
  is_new_player: boolean;
};

function BackLink({ to }: { to: TournamentsPath }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to={to}>
        <ArrowLeft size={14} className="mr-1" /> Regresar
      </Link>
    </Button>
  );
}

export function TournamentDetailHeader({
  backTo,
  game,
  store,
  date,
  badge,
  children,
  compact,
}: {
  backTo: TournamentsPath;
  game: string;
  store: string;
  date: string;
  badge: React.ReactNode;
  children?: React.ReactNode;
  /** Organizador: una tienda, así que la tienda va en el subtítulo y el breadcrumb ya es el "regresar". */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <header className="space-y-3">
        <nav
          aria-label="Ruta"
          className="flex items-center gap-2 text-sm text-foreground-secondary"
        >
          <Link to={backTo} className="underline-offset-2 hover:underline">
            Torneos
          </Link>
          <ChevronRight size={12} aria-hidden />
          <span className="text-foreground">Detalle</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{game}</h1>
            <p className="mt-1 text-sm text-foreground-secondary">
              {formatDate(date)} · {store}
            </p>
          </div>
          {badge}
        </div>
        {children}
      </header>
    );
  }
  return (
    <header className="space-y-3">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-xs text-gray-400">
        <Link to={backTo} className="hover:text-primary">
          Torneos
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span className="text-white">Detalle del Torneo</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {game} · {store}
          </h1>
          <p className="mt-1 text-sm text-gray-400">{formatDate(date)}</p>
        </div>
        {badge}
      </div>
      <BackLink to={backTo} />
      {children}
    </header>
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
  sub?: string;
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

export function TournamentSummary({
  tournament,
  store,
  game,
  results,
  uploader,
  uploaderDetail,
  csvUrl,
}: {
  tournament: {
    tournament_date: string;
    qualifying_semester: number | null;
    qualifying_year: number | null;
    created_at: string | null;
  };
  store: { name: string; city: string | null; state: string | null };
  game: { name: string };
  results: ResultRow[];
  uploader: string;
  uploaderDetail: string;
  csvUrl: string | null | undefined;
}) {
  const newPlayers = results.filter((r) => r.is_new_player).length;
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryCard
        icon={<StoreIcon size={16} />}
        title="Tienda"
        main={store.name}
        sub={[store.city, store.state].filter(Boolean).join(", ") || "—"}
      />
      <SummaryCard icon={<Gamepad2 size={16} />} title="Juego" main={game.name} />
      <SummaryCard
        icon={<Calendar size={16} />}
        title="Fecha"
        main={formatDate(tournament.tournament_date)}
        sub={`Semestre ${tournament.qualifying_semester} ${tournament.qualifying_year}`}
      />
      <SummaryCard
        icon={<User size={16} />}
        title="Subido por"
        main={uploader}
        sub={uploaderDetail}
      />
      <SummaryCard
        icon={<Upload size={16} />}
        title="Fecha de carga"
        main={tournament.created_at ? formatDateTime(tournament.created_at) : "—"}
      />
      <SummaryCard
        icon={<Users size={16} />}
        title="Participantes"
        main={`${results.length} jugadores`}
        sub={newPlayers > 0 ? `${newPlayers} nuevos` : ""}
      />
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
          <Upload size={16} /> Archivo de resultados
        </div>
        <div className="mt-2">
          <FileLink url={csvUrl} label="Descargar archivo" size="md" />
        </div>
      </div>
    </section>
  );
}

export function TournamentResults({ results }: { results: ResultRow[] }) {
  const newPlayers = results.filter((r) => r.is_new_player).length;
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">Resultados del torneo</h2>
        <span className="text-xs text-gray-400">
          Total: {results.length} participantes
          {newPlayers > 0 ? ` · ${newPlayers} jugadores nuevos` : ""}
        </span>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3">
                #
              </th>
              <th scope="col" className="px-4 py-3">
                Nexus Tag
              </th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">
                Match Pts
              </th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">
                OMW%
              </th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">
                Puntos
              </th>
              <th scope="col" className="px-4 py-3">
                Estado
              </th>
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
                    <Badge className="bg-orange-500/20 text-orange-200 border-orange-400/40">
                      Nuevo
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40">
                      Registrado
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Fact({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  /** Valores largos (nombre, correo): ocupan las dos columnas en móvil para no partirse a media palabra. */
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <dt className="text-sm text-foreground-secondary">{label}</dt>
      <dd className="mt-1 break-words font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Organizador: solo lo que el título (juego, fecha, tienda) no dice. Una fila de datos, sin tiles. */
export function UploaderSummary({
  tournament,
  results,
  uploader,
  uploaderDetail,
  csvUrl,
}: {
  tournament: {
    qualifying_semester: number | null;
    qualifying_year: number | null;
    created_at: string | null;
  };
  results: ResultRow[];
  uploader: string;
  uploaderDetail: string;
  csvUrl: string | null | undefined;
}) {
  const newPlayers = results.filter((r) => r.is_new_player).length;
  return (
    <section className={SECTION}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Participantes">
          <span className="font-mono-stat text-2xl font-bold">{results.length}</span>
          {newPlayers > 0 && (
            <span className="ml-2 text-sm font-normal text-foreground-secondary">
              {plural(newPlayers, "nuevo", "nuevos")}
            </span>
          )}
        </Fact>
        <Fact label="Subido por" wide>
          {uploader}
          {uploaderDetail && (
            <span className="block text-sm font-normal text-foreground-secondary">
              {uploaderDetail}
            </span>
          )}
        </Fact>
        <Fact label="Fecha de carga">
          {tournament.created_at ? formatDateTime(tournament.created_at) : "—"}
        </Fact>
        <Fact label="Semestre">
          {tournament.qualifying_semester != null && tournament.qualifying_year != null
            ? `${tournament.qualifying_semester} · ${tournament.qualifying_year}`
            : "—"}
        </Fact>
        <Fact label="Archivo de resultados" wide>
          <FileLink url={csvUrl} label="Descargar archivo" size="md" />
        </Fact>
      </dl>
    </section>
  );
}

/** Organizador: resultados en superficie plana, cifras en mono, sin scroll dentro del scroll. */
export function UploaderResults({ results }: { results: ResultRow[] }) {
  return (
    <section className={`${SURFACE} overflow-hidden`}>
      <div className="px-4 py-4 sm:px-6">
        <h2 className="text-xl font-semibold text-foreground">Resultados</h2>
      </div>
      {results.length === 0 && (
        <p className="border-t border-border px-4 py-6 text-sm text-foreground-secondary sm:px-6">
          Este torneo no tiene resultados cargados.
        </p>
      )}
      <div className={`overflow-x-auto ${results.length === 0 ? "hidden" : ""}`}>
        <table className="w-full text-sm">
          <thead className="border-y border-border text-left text-foreground-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                #
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Nexus Tag
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                Puntos de match
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                OMW%
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                Puntos
              </th>
              <th scope="col" className="px-4 py-3" aria-label="Jugador nuevo" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {results.map((r) => (
              <tr key={`${r.rank}-${r.geek_tag}`}>
                <td className="px-4 py-3 font-mono-stat font-semibold text-foreground">{r.rank}</td>
                <td className="px-4 py-3 text-foreground">{r.geek_tag}</td>
                <td className="px-4 py-3 text-right font-mono-stat text-foreground-secondary">
                  {r.match_points ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono-stat text-foreground-secondary">
                  {typeof r.omw_percentage === "number" ? `${r.omw_percentage.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono-stat font-semibold text-foreground">
                  {r.points_earned}
                </td>
                <td className="px-4 py-3">
                  {r.is_new_player && (
                    <Badge variant="outline" className="text-xs text-foreground-secondary">
                      Nuevo
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TournamentDetailSkeleton({ className = "space-y-6" }: { className?: string }) {
  return (
    <div className={className}>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4 space-y-2">
            <SkeletonLine width="w-20" height="h-3" />
            <SkeletonLine width="w-32" height="h-5" />
          </div>
        ))}
      </section>
      <div className="glass rounded-2xl p-5 space-y-3">
        <SkeletonLine width="w-40" height="h-4" />
        <SkeletonBlock className="h-10 w-full rounded-xl" />
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TournamentRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Sin esto, un torneo que no existe o un fallo de red deja la página en skeleton.
export function TournamentDetailError({
  backTo,
  message,
  onRetry,
}: {
  backTo: TournamentsPath;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <BackLink to={backTo} />
      <div className="glass rounded-2xl">
        <LoadError message={message} onRetry={onRetry} />
      </div>
    </div>
  );
}
