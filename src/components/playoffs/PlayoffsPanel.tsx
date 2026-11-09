import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  createPlayoffBracket,
  freezePlayoffGroups,
  getPlayoffsLevelOne,
  savePlayoffMatch,
  type FrozenMatch,
} from "@/lib/nexus-playoffs.functions";
import { FINAL_REGION, LEVEL_NAMES } from "@/lib/playoffs";

const QUERY_KEY = ["playoffs-level-one"];

/** Captura del Playoff Subregional: congelar grupos y registrar partidas. Admin y Manager. */
export function PlayoffsPanel() {
  const fetchLevelOne = useServerFn(getPlayoffsLevelOne);
  const freeze = useServerFn(freezePlayoffGroups);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchLevelOne(),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3>(1);

  const freezeMutation = useMutation({
    mutationFn: (region: string) => freeze({ data: { region } }),
    onSuccess: () => {
      toast.success("Grupos congelados");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.06]" />;
  if (isError) return <p className="text-sm text-foreground-secondary">No se pudo cargar.</p>;
  if (!data || data.subregions.length === 0) {
    return <p className="text-sm text-foreground-secondary">Todavía no hay clasificación.</p>;
  }

  const subregion = data.subregions.find((s) => s.name === selected) ?? data.subregions[0];
  const frozen = subregion.frozen;
  const full = subregion.players.length === 16;

  return (
    <div>
      <PageHeader
        eyebrow={`${data.season_name} · One Piece`}
        title="Playoffs · Captura"
        description="Congela los grupos al cerrar la clasificación y registra los resultados."
      />

      <div className="mb-5 flex gap-2" role="group" aria-label="Nivel">
        {([1, 2, 3] as const).map((n) => (
          <Button
            key={n}
            variant={n === level ? "default" : "outline"}
            aria-pressed={n === level}
            onClick={() => setLevel(n)}
          >
            {LEVEL_NAMES[n]}
          </Button>
        ))}
      </div>

      {level !== 1 ? (
        <BracketCapture key={level} data={data} level={level} />
      ) : (
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
                {s.frozen ? " ✓" : ""}
              </button>
            ))}
          </div>

          {!frozen ? (
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-foreground">
                {data.can_freeze
                  ? full
                    ? `${subregion.name} tiene sus 16 clasificados. Al congelar, los resultados de torneos ya no mueven a nadie.`
                    : `${subregion.name} tiene ${subregion.players.length} de 16 clasificados.`
                  : `La clasificación sigue abierta: ${data.closed_months.length} de ${data.months.length} meses cerrados.`}
              </p>
              <Button
                className="mt-4"
                disabled={!data.can_freeze || !full || freezeMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Congelar los grupos de ${subregion.name}? No se puede deshacer.`,
                    )
                  ) {
                    freezeMutation.mutate(subregion.name);
                  }
                }}
              >
                Congelar grupos
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                {frozen.groups.map((group, index) => (
                  <section key={group.players[0].player_id} className="glass rounded-2xl p-4">
                    <h2 className="mb-3 text-lg font-bold text-foreground">
                      Grupo {String.fromCharCode(65 + index)}
                    </h2>
                    <ul className="mb-3 space-y-1">
                      {group.players.map((p) => (
                        <li key={p.player_id} className="flex justify-between gap-2 text-sm">
                          <span className="truncate text-foreground">
                            #{p.seed} {p.geek_tag}
                            {p.advances ? " · Pasa" : ""}
                          </span>
                          <span className="flex-shrink-0 text-foreground-secondary">
                            {p.wins}-{p.losses}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="space-y-2">
                      {group.matches.map((m) => (
                        <MatchRow key={m.id} match={m} bestOfThree={false} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <section className="glass rounded-2xl p-4">
                <h2 className="mb-3 text-lg font-bold text-foreground">Top 8 · Cuartos (Bo3)</h2>
                {frozen.bracket.length === 0 ? (
                  <p className="text-sm text-foreground-secondary">
                    Se genera al capturar todas las partidas de grupos.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {frozen.bracket.map((m) => (
                      <MatchRow key={m.id} match={m} bestOfThree />
                    ))}
                  </div>
                )}
                {frozen.top_four.length > 0 && (
                  <p className="mt-3 text-sm text-foreground">
                    Suben al Playoff de Ciudad: {frozen.top_four.join(", ")}
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type PlayoffsData = NonNullable<Awaited<ReturnType<typeof getPlayoffsLevelOne>>>;

function BracketCapture({ data, level }: { data: PlayoffsData; level: 2 | 3 }) {
  const create = useServerFn(createPlayoffBracket);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [tags, setTags] = useState(["", "", "", ""]);
  const mutation = useMutation({
    mutationFn: (region: string) =>
      create({ data: { level, region, extended_tags: level === 3 ? tags : [] } }),
    onSuccess: () => {
      toast.success("Llave creada");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const parent = data.parents.find((p) => p.name === selected) ?? data.parents[0];
  const region = level === 2 ? parent.name : FINAL_REGION;
  const bracket = level === 2 ? parent.bracket : data.final.bracket;
  const ready = level === 2 ? parent.ready : data.final.ready;

  return (
    <div>
      {level === 2 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Región">
          {data.parents.map((p) => (
            <button
              key={p.name}
              type="button"
              aria-pressed={p.name === parent.name}
              onClick={() => setSelected(p.name)}
              className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                p.name === parent.name
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/10 text-foreground-secondary hover:border-white/25"
              }`}
            >
              {p.name}
              {p.bracket ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}

      {!bracket ? (
        <div className="glass rounded-2xl p-5">
          <p className="text-sm text-foreground">
            {ready
              ? `${region} ya tiene a sus clasificados. Al crear la llave se ordenan del 1 al 16 con el ranking general.`
              : level === 2
                ? `Faltan subregiones de ${region} por terminar su Top 8.`
                : "Faltan regiones por terminar su Playoff de Ciudad."}
          </p>
          {level === 3 && ready && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {tags.map((tag, index) => (
                <input
                  key={index}
                  aria-label={`Jugador ${index + 1} de Región Extendida`}
                  placeholder={`Región Extendida ${index + 1} (Geek Tag)`}
                  value={tag}
                  onChange={(e) => setTags(tags.map((t, i) => (i === index ? e.target.value : t)))}
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
                />
              ))}
            </div>
          )}
          <Button
            className="mt-4"
            disabled={!ready || mutation.isPending || (level === 3 && tags.some((t) => !t.trim()))}
            onClick={() => {
              if (window.confirm(`¿Crear la llave de ${region}? No se puede deshacer.`)) {
                mutation.mutate(region);
              }
            }}
          >
            Crear llave
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {bracket.rounds
            .filter((round) => round.matches.length > 0)
            .map((round) => (
              <section key={round.name} className="glass rounded-2xl p-4">
                <h2 className="mb-3 text-lg font-bold text-foreground">{round.name} (Bo3)</h2>
                <div className="space-y-2">
                  {round.matches.map((m) => (
                    <MatchRow key={m.id} match={m} bestOfThree />
                  ))}
                </div>
              </section>
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
    </div>
  );
}

function MatchRow({ match, bestOfThree }: { match: FrozenMatch; bestOfThree: boolean }) {
  const save = useServerFn(savePlayoffMatch);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (result: {
      winner_id: string | null;
      loser_wins: number | null;
      forfeit: boolean;
    }) => save({ data: { match_id: match.id, ...result } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message),
  });

  const result = match.forfeit ? "default" : String(match.loser_wins ?? 0);
  const send = (winnerId: string | null, value: string) =>
    mutation.mutate({
      winner_id: winnerId,
      loser_wins: bestOfThree && value !== "default" ? Number(value) : null,
      forfeit: value === "default",
    });
  const player = (id: string, tag: string) => (
    <button
      type="button"
      disabled={mutation.isPending}
      aria-pressed={match.winner_id === id}
      // Volver a tocar al ganador borra el resultado.
      onClick={() => send(match.winner_id === id ? null : id, result)}
      className={`min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-sm transition ${
        match.winner_id === id
          ? "border-primary/60 bg-primary/15 font-semibold text-primary"
          : "border-white/10 text-foreground hover:border-white/25"
      }`}
    >
      {tag}
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      {player(match.player_a, match.tag_a)}
      <span className="text-xs text-foreground-secondary">vs</span>
      {player(match.player_b, match.tag_b)}
      <select
        aria-label="Resultado"
        value={result}
        disabled={!match.winner_id || mutation.isPending}
        onChange={(e) => send(match.winner_id, e.target.value)}
        className="rounded-md border border-white/10 bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
      >
        {bestOfThree ? (
          <>
            <option value="0">2-0</option>
            <option value="1">2-1</option>
          </>
        ) : (
          <option value="0">Jugada</option>
        )}
        <option value="default">Default</option>
      </select>
    </div>
  );
}
