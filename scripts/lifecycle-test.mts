// Pruebas del ciclo de publicación contra el proyecto de PRUEBAS (nexus-admin-test).
// Nunca contra producción. Lee NEXUS_URL y NEXUS_SERVICE_ROLE_KEY de .env.test.
//   npx tsx scripts/lifecycle-test.mts
import fs from "node:fs";

const PROD_REF = "tbtyxtigbsljyrwyelqr";
for (const line of fs.readFileSync(new URL("../.env.test", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}
if (!process.env.NEXUS_URL || !process.env.NEXUS_SERVICE_ROLE_KEY) {
  throw new Error(".env.test necesita NEXUS_URL y NEXUS_SERVICE_ROLE_KEY del proyecto de pruebas");
}
if (process.env.NEXUS_URL.includes(PROD_REF)) throw new Error("Rechazado: NEXUS_URL apunta a producción");

const { getNexusAdmin } = await import("../src/lib/nexus-admin.server.ts");
const pub = await import("../src/lib/nexus-publication.server.ts");
const admin = getNexusAdmin();

const mx = (local: string) => new Date(`${local}-06:00`);
const SUN_27 = mx("2026-09-27T00:00:00");
const plus48 = (d: Date) => new Date(d.getTime() + 48 * 3600e3).toISOString();
const results: Array<{ ok: string; scenario: string; expected: string; actual: string }> = [];
async function check(scenario: string, expected: string, fn: () => Promise<string>) {
  let actual: string;
  try {
    actual = await fn();
  } catch (e) {
    actual = `ERROR ${(e as Error).message}`;
  }
  results.push({ ok: actual === expected ? "✔" : "✘", scenario, expected, actual });
}
async function q<T = any>(p: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- limpieza y siembra (solo proyecto de pruebas) ----------
const ZERO = "00000000-0000-0000-0000-000000000000";
for (const t of ["leaderboard_snapshots", "tournament_results", "notifications", "admin_audit_log", "tournaments", "seasons"]) {
  await q(admin.from(t as any).delete().neq("id", ZERO));
}
const season = await q(admin.from("seasons").insert({ name: "Temporada 2026 (prueba)", slug: "t2026-test", start_date: "2026-01-01", end_date: "2026-12-31", is_active: true, status: "ACTIVE" }).select("id, slug").single());
const game = await q(admin.from("games").upsert({ slug: "one-piece-test", name: "One Piece (prueba)" }, { onConflict: "slug" }).select("id").single());
const store = await q(admin.from("stores").upsert({ slug: "tienda-prueba", name: "Tienda Prueba", city: "Monterrey" }, { onConflict: "slug" }).select("id").single());
const players: string[] = [];
for (let i = 1; i <= 4; i++) {
  const p = await q(admin.from("players").upsert({ geek_tag: `Jugador${i}Test`, home_store_id: store.id }, { onConflict: "geek_tag" }).select("id").single());
  players.push(p.id);
}
const adminPlayer = await q<{ id: string; role: string; geek_tag: string }>(
  admin.from("players").upsert({ geek_tag: "AdminTest", role: "admin" }, { onConflict: "geek_tag" }).select("id, role, geek_tag").single(),
);

async function makeTournament(o: { date: string; status: string; approvedAt?: Date; results?: boolean; rejection?: string }) {
  const [y, m] = o.date.split("-").map(Number);
  const t = await q(admin.from("tournaments").insert({
    store_id: store.id, game_id: game.id, tournament_date: o.date, qualifying_year: y, qualifying_month: m,
    qualifying_semester: m <= 6 ? 1 : 2, status: o.status as any,
    approved_at: o.approvedAt?.toISOString() ?? null, undo_deadline: o.approvedAt ? plus48(o.approvedAt) : null,
    rejection_reason: o.rejection ?? null, approved_by: o.approvedAt ? adminPlayer.id : null,
  }).select("id").single());
  if (o.results !== false) {
    await q(admin.from("tournament_results").insert(players.map((pid, i) => ({
      tournament_id: t.id, player_id: pid, rank: i + 1, points_earned: 100 - i * 25, match_points: 9 - i * 3, wins: 3 - i, losses: i,
    }))));
  }
  return t.id as string;
}
const status = async (id: string) => (await q(admin.from("tournaments").select("status").eq("id", id).single())).status;
const count = async (p: PromiseLike<any>) => String(((await q<any[]>(p)) ?? []).length);

const A = await makeTournament({ date: "2026-09-22", status: "APPROVED", approvedAt: mx("2026-09-24T10:00:00") });
const B = await makeTournament({ date: "2026-09-22", status: "APPROVED", approvedAt: mx("2026-09-25T09:00:00") });
const C = await makeTournament({ date: "2026-09-23", status: "APPROVED", approvedAt: mx("2026-09-25T00:00:00") });
const D = await makeTournament({ date: "2026-09-27", status: "APPROVED", approvedAt: mx("2026-09-20T10:00:00") });
const E = await makeTournament({ date: "2025-12-15", status: "APPROVED", approvedAt: mx("2026-09-20T10:00:00") });
const F = await makeTournament({ date: "2026-09-21", status: "APPROVED", approvedAt: mx("2026-09-20T10:00:00"), results: false });
const G = await makeTournament({ date: "2026-09-21", status: "DRAFT", rejection: "CSV incompleto" });
const name: Record<string, string> = { [A]: "A", [B]: "B", [C]: "C", [D]: "D", [E]: "E", [F]: "F", [G]: "G" };

await check("1. Dry run no escribe", "would=A,C status(A)=APPROVED audits=0", async () => {
  const r = await pub.runScheduledPublication(admin, { now: SUN_27, dryRun: true });
  return `would=${r.published.map((i) => name[i]).sort().join(",")} status(A)=${await status(A)} audits=${await count(admin.from("admin_audit_log").select("id"))}`;
});
let run1: any;
await check("2. Domingo 00:00: publica solo elegibles (incl. corte exacto del viernes)", "A,C", async () => {
  run1 = await pub.runScheduledPublication(admin, { now: SUN_27 });
  return run1.published.map((i: string) => name[i]).sort().join(",");
});
await check("3. Omitidos con motivo", "B:correction_window D:future_date E:out_of_season F:no_results", async () =>
  run1.skipped.map((s: any) => `${name[s.id]}:${s.reasons.join("+")}`).sort().join(" "));
await check("4. Rechazado nunca se publica", "DRAFT", async () => status(G));
await check("5. approved_at se conserva al publicar", mx("2026-09-24T10:00:00").toISOString(), async () =>
  new Date((await q(admin.from("tournaments").select("approved_at").eq("id", A).single())).approved_at).toISOString());
await check("6. Auditoría: Sistema/scheduled + inicio/fin", "published=2 started=1 finished=1", async () => {
  const rows = await q<any[]>(admin.from("admin_audit_log").select("action, actor_id, actor_role, metadata"));
  const p = rows.filter((r) => r.action === "TOURNAMENT_PUBLISHED" && r.actor_id === null && r.actor_role === "system" && r.metadata?.trigger === "scheduled").length;
  return `published=${p} started=${rows.filter((r) => r.action === "SCHEDULED_PUBLICATION_RUN_STARTED").length} finished=${rows.filter((r) => r.action === "SCHEDULED_PUBLICATION_RUN_FINISHED").length}`;
});
await check("7. Ranking recalculado", "MONTHLY=4 SEMESTRAL=4", async () => {
  const rows = await q<any[]>(admin.from("leaderboard_snapshots").select("timeframe_type").eq("store_id", store.id));
  return `MONTHLY=${rows.filter((r) => r.timeframe_type === "MONTHLY").length} SEMESTRAL=${rows.filter((r) => r.timeframe_type === "SEMESTRAL").length}`;
});
await check("8. Notificaciones in-app (2 torneos x 4 jugadores)", "8", () => count(admin.from("notifications").select("id").eq("type", "tournament_published")));
await check("9. Logros sin errores", "0", async () => String(run1.achievement_failures.length));
await check("10. Segunda corrida publica 0", "0", async () => String((await pub.runScheduledPublication(admin, { now: SUN_27 })).published.length));
await check("11. Notificaciones no se duplican", "8", () => count(admin.from("notifications").select("id").eq("type", "tournament_published")));
await makeTournament({ date: "2026-09-22", status: "APPROVED", approvedAt: mx("2026-09-23T10:00:00") });
await check("12. Dos corridas simultáneas publican una sola vez", "1", async () => {
  const [r1, r2] = await Promise.all([pub.runScheduledPublication(admin, { now: SUN_27 }), pub.runScheduledPublication(admin, { now: SUN_27 })]);
  return String(r1.published.length + r2.published.length);
});
const fri = mx("2026-09-25T12:00:00");
await check("13. Publicar ahora rechaza fecha futura", "future_date", async () => {
  const fut = await makeTournament({ date: "2026-09-26", status: "APPROVED", approvedAt: mx("2026-09-24T10:00:00") });
  return (await pub.publishTournamentsCore(admin, { ids: [fut], actor: adminPlayer, trigger: "manual", now: fri })).skipped[0]?.reasons.join("+") ?? "published";
});
await check("14. Publicar ahora ignora la ventana de corrección", "1", async () =>
  String((await pub.publishTournamentsCore(admin, { ids: [B], actor: adminPlayer, trigger: "manual", now: fri })).published.length));
let partial = "";
await check("15. Falla parcial: publicado, falla reportada", "published=1 reported=yes status=PUBLISHED", async () => {
  partial = await makeTournament({ date: "2026-09-21", status: "APPROVED", approvedAt: mx("2026-09-20T10:00:00") });
  const failing = new Proxy(admin, {
    get(target, prop, recv) {
      if (prop !== "from") return Reflect.get(target, prop, recv);
      return (table: string) => {
        const b: any = (target as any).from(table);
        if (table !== "leaderboard_snapshots") return b;
        return new Proxy(b, { get: (bt, k) => (k === "insert" ? async () => ({ error: { message: "fallo simulado" } }) : Reflect.get(bt, k)) });
      };
    },
  });
  const r = await pub.publishTournamentsCore(failing as any, { ids: [partial], actor: adminPlayer, trigger: "manual", now: SUN_27 });
  return `published=${r.published.length} reported=${r.recompute_failures.length > 0 ? "yes" : "no"} status=${await status(partial)}`;
});
await check("16. Recuperación con recomputeTournamentRankings", "failures=0 snapshots=yes", async () => {
  const r = await pub.recomputeTournamentRankingsCore(admin, partial, adminPlayer);
  const n = (await q<any[]>(admin.from("leaderboard_snapshots").select("id").eq("store_id", store.id).eq("timeframe_type", "MONTHLY"))).length;
  return `failures=${r.recompute_failures.length} snapshots=${n > 0 ? "yes" : "no"}`;
});
await check("17. Recuperación idempotente", "same", async () => {
  const snap = async () => JSON.stringify(await q(admin.from("leaderboard_snapshots").select("player_id, timeframe_type, total_points, rank_position").eq("store_id", store.id).order("player_id").order("timeframe_type")));
  const before = await snap();
  await pub.recomputeTournamentRankingsCore(admin, partial, adminPlayer);
  return (await snap()) === before ? "same" : "different";
});

console.table(results);
const failed = results.filter((r) => r.ok !== "✔").length;
console.log(failed ? `${failed} escenario(s) fallaron` : `Los ${results.length} escenarios pasaron`);
process.exit(failed ? 1 : 0);
