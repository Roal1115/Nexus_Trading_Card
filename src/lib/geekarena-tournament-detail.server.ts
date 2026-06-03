// Shared server-only helper that builds the tournament detail payload
// consumed by both /admin and /tcg-manager review screens.
import type { getGeekarenaAdmin } from "./geekarena-admin.server";

type Admin = ReturnType<typeof getGeekarenaAdmin>;

type Alert = {
  level: "CRITICAL" | "WARNING";
  message: string;
  link?: { to: string; label: string } | null;
};

export async function loadTournamentDetail(
  admin: Admin,
  tournament_id: string,
  reviewBasePath: "/admin" | "/tcg-manager" = "/admin",
) {
  const { data: t, error: te } = await admin
    .from("tournaments")
    .select(
      "id, store_id, game_id, status, tournament_date, qualifying_month, qualifying_semester, qualifying_year, approved_at, undo_deadline, published_at, created_at, rejection_reason, csv_url",
    )
    .eq("id", tournament_id)
    .maybeSingle();
  if (te) throw new Error(te.message);
  if (!t) throw new Error("Torneo no encontrado");

  const [storeRes, gameRes, resultsRes] = await Promise.all([
    admin
      .from("stores")
      .select("id, name, city, state")
      .eq("id", t.store_id)
      .maybeSingle(),
    admin
      .from("games")
      .select("id, name, slug")
      .eq("id", t.game_id)
      .maybeSingle(),
    (async () => {
      const full = await admin
        .from("tournament_results")
        .select(
          "player_id, rank, wins, losses, draws, points_earned, match_points, omw_percentage",
        )
        .eq("tournament_id", t.id)
        .order("rank", { ascending: true });
      if (full.error && /column .* does not exist/i.test(full.error.message)) {
        return await admin
          .from("tournament_results")
          .select("player_id, rank, wins, losses, points_earned")
          .eq("tournament_id", t.id)
          .order("rank", { ascending: true });
      }
      return full;
    })(),
  ]);
  if (storeRes.error) throw new Error(storeRes.error.message);
  if (gameRes.error) throw new Error(gameRes.error.message);
  if (resultsRes.error) throw new Error(resultsRes.error.message);

  const playerIds = Array.from(
    new Set((resultsRes.data ?? []).map((r: any) => r.player_id)),
  );
  const playersRes = playerIds.length
    ? await admin
        .from("players")
        .select("id, geek_tag, email, created_at, home_store_id")
        .in("id", playerIds)
    : { data: [] as any[], error: null };
  if ((playersRes as any).error) throw new Error((playersRes as any).error.message);

  const pMap = new Map<string, any>(
    ((playersRes as any).data ?? []).map((p: any) => [p.id, p]),
  );

  const tCreated = new Date(t.created_at ?? new Date().toISOString()).getTime();
  const results = (resultsRes.data ?? []).map((r: any) => {
    const p = pMap.get(r.player_id);
    const pCreated = p?.created_at ? new Date(p.created_at).getTime() : 0;
    return {
      rank: r.rank,
      geek_tag: p?.geek_tag ?? "—",
      match_points: r.match_points ?? null,
      omw_percentage: r.omw_percentage ?? null,
      points_earned: r.points_earned ?? 0,
      wins: r.wins ?? 0,
      losses: r.losses ?? 0,
      draws: r.draws ?? 0,
      is_new_player: p
        ? Math.abs(pCreated - tCreated) < 60_000 || pCreated >= tCreated
        : false,
    };
  });

  const { data: orgs } = await admin
    .from("players")
    .select("geek_tag, email, role")
    .eq("home_store_id", t.store_id)
    .in("role", ["organizer", "admin"])
    .limit(1);
  const uploaded_by = orgs && orgs[0]
    ? { geek_tag: orgs[0].geek_tag, email: orgs[0].email }
    : null;

  const alerts: Alert[] = [];

  const { data: dups } = await admin
    .from("tournaments")
    .select("id, status")
    .eq("store_id", t.store_id)
    .eq("game_id", t.game_id)
    .eq("tournament_date", t.tournament_date)
    .neq("id", t.id)
    .in("status", ["APPROVED", "PUBLISHED"]);
  for (const d of dups ?? []) {
    alerts.push({
      level: "CRITICAL",
      message: `Ya existe un torneo ${d.status} de ${gameRes.data?.name ?? ""} en ${storeRes.data?.name ?? ""} el ${t.tournament_date}`,
      link: { to: `${reviewBasePath}/tournaments/${d.id}`, label: "Ver torneo existente" },
    });
  }

  if (playerIds.length > 0) {
    const { data: sameDayT } = await admin
      .from("tournaments")
      .select("id")
      .eq("game_id", t.game_id)
      .eq("tournament_date", t.tournament_date)
      .neq("id", t.id);
    const sameDayIds = (sameDayT ?? []).map((x) => x.id);
    if (sameDayIds.length > 0) {
      const { data: clash } = await admin
        .from("tournament_results")
        .select("player_id, tournament_id")
        .in("tournament_id", sameDayIds)
        .in("player_id", playerIds);
      const clashedPlayerIds = Array.from(
        new Set((clash ?? []).map((c) => c.player_id)),
      );
      for (const pid of clashedPlayerIds) {
        const tag = pMap.get(pid)?.geek_tag ?? pid;
        alerts.push({
          level: "CRITICAL",
          message: `El jugador ${tag} aparece en otro torneo de ${gameRes.data?.name ?? ""} el mismo día ${t.tournament_date}`,
          link: null,
        });
      }
    }
  }

  const newCount = results.filter((r) => r.is_new_player).length;
  if (newCount > 0) {
    alerts.push({
      level: "WARNING",
      message: `${newCount} jugadores nuevos serán registrados automáticamente al aprobar`,
      link: null,
    });
  }

  if (t.created_at && t.tournament_date) {
    const dt = new Date(t.tournament_date + "T00:00:00").getTime();
    const cr = new Date(t.created_at).getTime();
    const days = Math.floor((cr - dt) / 86_400_000);
    if (days > 3) {
      alerts.push({
        level: "WARNING",
        message: `Este torneo fue subido ${days} días después de la fecha del torneo`,
        link: null,
      });
    }
  }

  const haveMp = results.some((r) => typeof r.match_points === "number");
  if (haveMp) {
    const sorted = [...results].sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].match_points ?? -Infinity;
      const cur = sorted[i].match_points ?? -Infinity;
      if (cur > prev) {
        alerts.push({
          level: "WARNING",
          message: `El participante #${sorted[i].rank} tiene ${cur} match points pero está en posición ${sorted[i].rank}`,
          link: null,
        });
        break;
      }
    }
  }

  return {
    tournament: {
      id: t.id,
      status: t.status,
      tournament_date: t.tournament_date,
      qualifying_month: t.qualifying_month,
      qualifying_semester: t.qualifying_semester,
      qualifying_year: t.qualifying_year,
      approved_at: t.approved_at,
      undo_deadline: t.undo_deadline,
      published_at: t.published_at,
      created_at: t.created_at,
      rejection_reason: (t as any).rejection_reason ?? null,
    },
    store: storeRes.data ?? { id: t.store_id, name: "—", city: null, state: null },
    game: gameRes.data ?? { id: t.game_id, name: "—", slug: "" },
    uploaded_by,
    results,
    alerts,
  };
}
