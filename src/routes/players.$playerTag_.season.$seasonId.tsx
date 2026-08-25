import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, Download, Share2, Check, Trophy, Target } from "lucide-react";
import { getSeasonProfile } from "@/lib/nexus-season-profile.functions";
import { seasonProfileQuery } from "@/lib/season-profile-queries";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/players/$playerTag_/season/$seasonId")({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        seasonProfileQuery(params.playerTag, params.seasonId),
      );
    } catch {
      return undefined;
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `Temporada de ${params.playerTag} — Nexus` },
      {
        name: "description",
        content: `Récord, líder más jugado y ranking de ${params.playerTag} en el circuito Nexus.`,
      },
      { property: "og:title", content: `Temporada de ${params.playerTag} — Trading Card Nexus` },
      {
        property: "og:description",
        content: `Mira el récord y stats de temporada de ${params.playerTag} en el circuito TCG de México.`,
      },
      {
        property: "og:url",
        content: `https://mxntcg.lovable.app/players/${params.playerTag}/season/${params.seasonId}`,
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeasonProfilePage,
});

type SeasonProfile = Awaited<ReturnType<typeof getSeasonProfile>>;

function wrColor(wr: number): string {
  if (wr >= 55) return "text-emerald-400";
  if (wr >= 45) return "text-white";
  return "text-red-400";
}

// Dibuja la tarjeta 1200x630 en canvas y descarga como PNG.
async function downloadCard(p: any) {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Fondo
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0f1117");
  grad.addColorStop(1, "#131a2b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(50,217,255,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Imagen del líder más jugado (si CORS lo permite)
  const topLeader = p.leaders?.[0];
  if (topLeader?.leader_image) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = topLeader.leader_image;
      });
      const iw = 280;
      const ih = (img.height / img.width) * iw;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(img, W - iw - 70, (H - ih) / 2, iw, ih);
      ctx.restore();
    } catch {
      // sin imagen: la tarjeta sigue siendo válida en texto
    }
  }

  ctx.fillStyle = "#32d9ff";
  ctx.font = "bold 26px Inter, sans-serif";
  ctx.fillText("TRADING CARD NEXUS", 70, 90);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px Inter, sans-serif";
  ctx.fillText(p.player.geek_tag, 70, 185);

  ctx.fillStyle = "#7A8CAD";
  ctx.font = "600 30px Inter, sans-serif";
  ctx.fillText(p.season.name, 70, 235);

  const r = p.record;
  const wr = r && r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : null;

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 96px 'JetBrains Mono', monospace";
  ctx.fillText(`${r?.wins ?? 0}-${r?.losses ?? 0}${r?.draws ? `-${r.draws}` : ""}`, 70, 370);
  ctx.fillStyle = "#7A8CAD";
  ctx.font = "600 24px Inter, sans-serif";
  ctx.fillText(`RÉCORD${wr !== null ? ` · ${wr}% WIN RATE` : ""}`, 70, 410);

  let y = 480;
  if (p.rank) {
    ctx.fillStyle = "#32d9ff";
    ctx.font = "bold 40px Inter, sans-serif";
    ctx.fillText(`#${p.rank}`, 70, y);
    ctx.fillStyle = "#7A8CAD";
    ctx.font = "600 22px Inter, sans-serif";
    ctx.fillText(`de ${p.total_players} en el ranking · ${r?.points ?? 0} pts`, 160, y);
    y += 60;
  }
  if (topLeader) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 28px Inter, sans-serif";
    ctx.fillText(`Líder más jugado: ${topLeader.leader_name}`, 70, y);
  }

  const a = document.createElement("a");
  a.download = `${p.player.geek_tag}-${p.season.slug ?? "temporada"}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

function SeasonProfilePage() {
  const { playerTag, seasonId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const [copied, setCopied] = useState(false);

  const { data, isLoading: loading } = useQuery({
    ...seasonProfileQuery(playerTag, seasonId),
    initialData: loaderData,
    retry: false,
  });

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Temporada de ${playerTag}`, url });
        return;
      }
    } catch {
      /* usuario canceló */
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <SkeletonBlock className="h-64 rounded-2xl" />
        <SkeletonBlock className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!data || "not_found" in data) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Perfil no encontrado</h2>
        <Link to="/" className="mt-6 text-sm text-primary hover:underline">
          Ir al inicio
        </Link>
      </main>
    );
  }

  if ("is_private" in data) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Este perfil es privado</h2>
        <p className="mt-2 text-sm text-gray-400">
          {data.geek_tag} ha decidido mantener sus stats en privado.
        </p>
      </main>
    );
  }

  const p = data as Extract<SeasonProfile, { record: any }>;
  const r = p.record;
  const wr = r && r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : null;
  const topLeader = p.leaders[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      {/* Tarjeta principal */}
      <section className="glass relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {p.player.avatar_url ? (
            <img
              src={p.player.avatar_url}
              alt={p.player.geek_tag}
              className="h-20 w-20 rounded-2xl border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-primary/10 text-2xl font-bold text-primary">
              {p.player.geek_tag.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              {p.season.name}
            </p>
            <h1 className="mt-1 truncate text-3xl font-bold text-white">{p.player.geek_tag}</h1>
            {p.player.display_name && (
              <p className="text-sm text-gray-400">{p.player.display_name}</p>
            )}
          </div>
          {topLeader?.leader_image && (
            <img
              src={topLeader.leader_image}
              alt={topLeader.leader_name}
              className="hidden h-28 w-20 rounded-lg border border-white/10 object-cover sm:block"
            />
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="font-mono text-2xl font-bold text-white">
              {r ? `${r.wins}-${r.losses}${r.draws ? `-${r.draws}` : ""}` : "—"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-500">Récord</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className={`font-mono text-2xl font-bold ${wr !== null ? wrColor(wr) : "text-gray-500"}`}>
              {wr !== null ? `${wr}%` : "—"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-500">Win rate</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="font-mono text-2xl font-bold text-primary">
              {p.rank ? `#${p.rank}` : "—"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-500">
              Ranking{p.total_players ? ` de ${p.total_players}` : ""}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="font-mono text-2xl font-bold text-white">{r?.points ?? 0}</div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-500">Puntos</div>
          </div>
        </div>

        {topLeader && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-300">
            <Crown size={14} className="text-amber-400" />
            Líder más jugado:{" "}
            <span className="font-semibold text-white">{topLeader.leader_name}</span>
            <span className="text-gray-500">
              ({topLeader.wins}-{topLeader.total_rounds - topLeader.wins},{" "}
              {topLeader.win_rate}%)
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => downloadCard(p)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90"
          >
            <Download size={14} /> Descargar tarjeta
          </button>
          <button
            onClick={share}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 transition hover:bg-white/5"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            {copied ? "Copiado" : "Compartir"}
          </button>
        </div>
      </section>

      {/* Stats por líder */}
      {p.leaders.length > 0 && (
        <section className="glass rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <Target size={14} className="text-primary" /> Stats por líder
          </h2>
          <div className="mt-4 space-y-2">
            {p.leaders.map((l) => (
              <div
                key={l.leader_id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                {l.leader_image ? (
                  <img
                    src={l.leader_image}
                    alt={l.leader_name}
                    className="h-10 w-7 rounded-md border border-white/10 object-cover"
                  />
                ) : (
                  <div className="h-10 w-7 rounded-md border border-white/10 bg-black/30" />
                )}
                <div className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {l.leader_name}
                </div>
                <div className="font-mono text-xs text-gray-400">
                  {l.wins}-{l.total_rounds - l.wins}
                </div>
                <div className={`w-14 text-right font-mono text-sm font-bold ${wrColor(l.win_rate)}`}>
                  {l.win_rate}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {r && (
        <p className="text-center text-[11px] text-gray-600">
          <Trophy size={11} className="mr-1 inline" />
          {r.tournaments_played} torneos jugados
          {r.best_rank && r.best_rank < 999 ? ` · mejor posición: #${r.best_rank}` : ""} ·{" "}
          {p.season.start_date} — {p.season.end_date}
        </p>
      )}
    </div>
  );
}
