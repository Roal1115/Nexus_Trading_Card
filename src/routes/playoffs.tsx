import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  getPlayoffsLevelOne,
  type BracketEvent,
  type FrozenEvent,
} from "@/lib/nexus-playoffs.functions";
import { LEVEL_NAMES, SEED_GROUPS } from "@/lib/playoffs";

export const Route = createFileRoute("/playoffs")({
  head: () => ({ meta: [{ title: "Playoffs — Nexus" }] }),
  component: PlayoffsPage,
});

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const monthName = (value: string) => MONTHS[Number(value.slice(5, 7)) - 1];

function FrozenView({ event }: { event: FrozenEvent }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {event.groups.map((group, index) => (
          <section key={group.players[0].player_id} className="glass rounded-2xl p-4">
            <h2 className="mb-3 text-lg font-bold text-foreground">
              Grupo {String.fromCharCode(65 + index)}
            </h2>
            <ol className="space-y-2">
              {group.players.map((p) => (
                <li
                  key={p.player_id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm"
                >
                  <Link
                    to="/players/$playerTag"
                    params={{ playerTag: p.geek_tag }}
                    className="min-w-0 truncate font-semibold text-foreground hover:text-primary"
                  >
                    #{p.seed} {p.geek_tag}
                  </Link>
                  <span className="flex-shrink-0 text-xs text-foreground-secondary">
                    {p.wins}-{p.losses}
                    {p.advances ? " · Pasa" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {event.bracket.length > 0 && (
        <section className="glass rounded-2xl p-4">
          <h2 className="mb-3 text-lg font-bold text-foreground">Top 8</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {event.bracket.map((m) => (
              <li
                key={m.id}
                className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-foreground"
              >
                <span className={m.winner_id === m.player_a ? "font-bold text-primary" : ""}>
                  {m.tag_a}
                </span>{" "}
                vs{" "}
                <span className={m.winner_id === m.player_b ? "font-bold text-primary" : ""}>
                  {m.tag_b}
                </span>
                {m.winner_id && (
                  <span className="text-foreground-secondary">
                    {" "}
                    · {m.forfeit ? "Default" : `2-${m.loser_wins ?? 0}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {event.top_four.length > 0 && (
            <p className="mt-3 text-sm text-foreground">
              Suben al Playoff de Ciudad: {event.top_four.join(", ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function BracketView({ title, bracket }: { title: string; bracket: BracketEvent | null }) {
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="mb-3 text-lg font-bold text-foreground">{title}</h2>
      {!bracket ? (
        <p className="text-sm text-foreground-secondary">
          La llave se arma al terminar el nivel anterior.
        </p>
      ) : (
        <div className="space-y-4">
          {bracket.rounds
            .filter((round) => round.matches.length > 0)
            .map((round) => (
              <div key={round.name}>
                <h3 className="mb-2 text-sm font-semibold text-primary">{round.name}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {round.matches.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-foreground"
                    >
                      <span className={m.winner_id === m.player_a ? "font-bold text-primary" : ""}>
                        {m.tag_a}
                      </span>{" "}
                      vs{" "}
                      <span className={m.winner_id === m.player_b ? "font-bold text-primary" : ""}>
                        {m.tag_b}
                      </span>
                      {m.winner_id && (
                        <span className="text-foreground-secondary">
                          {" "}
                          · {m.forfeit ? "Default" : `2-${m.loser_wins ?? 0}`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {bracket.top_four.length > 0 && (
            <p className="text-sm text-foreground">
              Suben al Torneo Nacional: {bracket.top_four.join(", ")}
            </p>
          )}
          {bracket.champion && (
            <p className="text-lg font-bold text-primary">Campeón: {bracket.champion}</p>
          )}
        </div>
      )}
    </section>
  );
}

function PlayoffsPage() {
  const fetchLevelOne = useServerFn(getPlayoffsLevelOne);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["playoffs-level-one"],
    queryFn: () => fetchLevelOne(),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3>(1);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.06]" />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageHeader eyebrow="Circuito" title="Playoffs" />
        <p className="text-sm text-foreground-secondary">
          No se pudieron cargar los playoffs. Intenta de nuevo en unos minutos.
        </p>
      </main>
    );
  }

  if (!data || data.subregions.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageHeader eyebrow="Circuito" title="Playoffs" />
        <p className="text-sm text-foreground-secondary">
          Todavía no hay clasificación para mostrar.
        </p>
      </main>
    );
  }

  const subregion = data.subregions.find((s) => s.name === selected) ?? data.subregions[0];
  const bySeed = new Map(subregion.players.map((p) => [p.seed, p]));
  const seasonOpen = data.closed_months.length < data.months.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        eyebrow={`${data.season_name} · One Piece`}
        title={`Playoffs · ${LEVEL_NAMES[level]}`}
        description={`Clasificación de ${monthName(data.months[0])} a ${monthName(data.months[4])}. Meses cerrados: ${data.closed_months.length} de ${data.months.length}.`}
      />

      <div className="mb-5 flex gap-2" role="group" aria-label="Nivel">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === level}
            onClick={() => setLevel(n)}
            className={`rounded-md border px-4 py-1.5 text-sm font-bold transition ${
              n === level
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/10 text-foreground-secondary hover:border-white/25"
            }`}
          >
            {LEVEL_NAMES[n]}
          </button>
        ))}
      </div>

      {level === 2 && (
        <div className="space-y-6">
          {data.parents.map((parent) => (
            <BracketView key={parent.name} title={parent.name} bracket={parent.bracket} />
          ))}
        </div>
      )}
      {level === 3 && <BracketView title={LEVEL_NAMES[3]} bracket={data.final.bracket} />}
      {level === 1 && (
        <>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Subregión">
            {data.subregions.map((s) => (
              <button
                key={s.name}
                type="button"
                aria-pressed={s.name === subregion.name}
                onClick={() => setSelected(s.name)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                  s.name === subregion.name
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/10 text-foreground-secondary hover:border-white/25"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {seasonOpen && !subregion.frozen && (
            <p className="mb-5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">
              Grupos provisionales: el orden de los grupos puede cambiar hasta que termine la
              clasificación.
            </p>
          )}

          {subregion.frozen ? (
            <FrozenView event={subregion.frozen} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {SEED_GROUPS.map((seeds, index) => (
                <section key={seeds[0]} className="glass rounded-2xl p-4">
                  <h2 className="mb-3 text-lg font-bold text-foreground">
                    Grupo {String.fromCharCode(65 + index)}
                  </h2>
                  <ol className="space-y-2">
                    {seeds.map((seed) => {
                      const player = bySeed.get(seed);
                      return (
                        <li key={seed} className="rounded-lg bg-white/[0.04] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 flex-shrink-0 text-xs font-bold text-primary">
                              #{seed}
                            </span>
                            {player ? (
                              <Link
                                to="/players/$playerTag"
                                params={{ playerTag: player.geek_tag }}
                                className="min-w-0 truncate text-sm font-semibold text-foreground hover:text-primary"
                              >
                                {player.geek_tag}
                              </Link>
                            ) : (
                              <span className="text-sm text-foreground-secondary">Por definir</span>
                            )}
                          </div>
                          {player && (
                            <p className="mt-1 pl-8 text-xs text-foreground-secondary">
                              {player.confirmed ? "Clasificado" : "Provisional"}
                              {player.month ? ` · ${monthName(player.month)}` : " · Puntos"} ·{" "}
                              {player.points} pts · {player.weeks_attended}/{data.required_weeks}{" "}
                              sem
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}

          <p className="mt-5 text-xs text-foreground-secondary">
            Para jugar el playoff se necesita asistir al menos a un torneo en {data.required_weeks}{" "}
            de las {data.total_weeks} semanas de la clasificación. Pasan los 2 mejores de cada grupo
            al Top 8; los 4 ganadores de cuartos suben al Playoff de Ciudad.
          </p>
        </>
      )}
    </main>
  );
}
