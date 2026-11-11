// Regresión de permisos de player_tcg_ids y recompute_player_achievements contra el
// proyecto de PRUEBAS (nexus-admin-test). Nunca contra producción.
// Lee NEXUS_URL, NEXUS_SERVICE_ROLE_KEY y NEXUS_ANON_KEY de .env.test.
//   npx tsx scripts/tcg-ids-hardening.test.mts
// Crea y borra datos con prefijo "zzhard"; no toca el esquema.
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PROD_REF = "tbtyxtigbsljyrwyelqr";
for (const line of fs.readFileSync(new URL("../.env.test", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const { NEXUS_URL, NEXUS_SERVICE_ROLE_KEY, NEXUS_ANON_KEY } = process.env;
if (!NEXUS_URL || !NEXUS_SERVICE_ROLE_KEY || !NEXUS_ANON_KEY) {
  throw new Error(".env.test necesita NEXUS_URL, NEXUS_SERVICE_ROLE_KEY y NEXUS_ANON_KEY del proyecto de pruebas");
}
if (NEXUS_URL.includes(PROD_REF)) throw new Error("Rechazado: NEXUS_URL apunta a producción");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(NEXUS_URL, NEXUS_SERVICE_ROLE_KEY, opts);
const anon = () => createClient(NEXUS_URL, NEXUS_ANON_KEY, opts);

const results: Array<{ ok: boolean; name: string; detail: string }> = [];
async function check(name: string, fn: () => Promise<string | true>) {
  try {
    const r = await fn();
    results.push({ ok: r === true, name, detail: r === true ? "" : r });
  } catch (e) {
    results.push({ ok: false, name, detail: `ERROR ${(e as Error).message}` });
  }
}
const rows = async (q: PromiseLike<{ data: any; error: any }>) => {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as any;
};
// supabase-js devuelve { error } sin lanzar: un caso negativo tiene que mirar el código.
const denied = (r: { error: { code?: string } | null }) =>
  r.error?.code === "42501" ? true : `esperaba 42501, recibió ${JSON.stringify(r.error) ?? "éxito"}`;

const TAG = `zzhard${Date.now().toString(36)}`;
const cleanupUsers: string[] = [];
async function cleanup() {
  const games = await rows(svc.from("games").select("id").like("slug", "zzhard%"));
  const gameIds = games.map((g: any) => g.id);
  const ts = await rows(svc.from("tournaments").select("id").in("game_id", gameIds));
  const tIds = ts.map((t: any) => t.id);
  await svc.from("tournament_results").delete().in("tournament_id", tIds);
  await svc.from("tournaments").delete().in("id", tIds);
  await svc.from("players").delete().like("geek_tag", "zzhard%");
  await svc.from("games").delete().in("id", gameIds);
  await svc.from("stores").delete().like("slug", "zzhard%");
  for (const id of cleanupUsers) await svc.auth.admin.deleteUser(id).catch(() => {});
}

const insertOne = (table: string, row: Record<string, unknown>) =>
  rows(svc.from(table).insert(row).select("id").single());

async function account(suffix: string, gameId: string, tcgId: string) {
  const email = `${TAG}${suffix}@example.test`;
  const password = randomUUID();
  const { data, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { geek_tag: `${TAG}${suffix}` },
  });
  if (error) throw new Error(error.message);
  cleanupUsers.push(data.user.id);
  // on_auth_user_created crea la fila de players.
  const player = await rows(svc.from("players").select("id").eq("auth_user_id", data.user.id).single());
  const tcgRow = await insertOne("player_tcg_ids", { player_id: player.id, game_id: gameId, tcg_user_id: tcgId });
  return { id: player.id as string, tcgRowId: tcgRow.id as string, email, password };
}

const g1 = (await insertOne("games", { slug: `${TAG}-g1`, name: `${TAG} g1` })).id as string;
const g2 = (await insertOne("games", { slug: `${TAG}-g2`, name: `${TAG} g2` })).id as string;
const store = (await insertOne("stores", { slug: `${TAG}-store`, name: `${TAG} store`, city: "Monterrey" })).id as string;
const a = await account("a", g1, "111");
const b = await account("b", g1, "222");

const user = anon();
const signIn = await user.auth.signInWithPassword({ email: a.email, password: a.password });
if (signIn.error) throw new Error(signIn.error.message);
const tcgValue = async (rowId: string) =>
  (await rows(svc.from("player_tcg_ids").select("tcg_user_id").eq("id", rowId).maybeSingle()))?.tcg_user_id;

// ---------- Escritura directa ----------
await check("1a. authenticated no puede insertar su propio ID", async () => {
  const r = await user.from("player_tcg_ids").insert({ player_id: a.id, game_id: g2, tcg_user_id: "999" });
  const left = await rows(svc.from("player_tcg_ids").select("id").eq("player_id", a.id).eq("game_id", g2));
  if (left.length) await svc.from("player_tcg_ids").delete().eq("player_id", a.id).eq("game_id", g2);
  return denied(r) === true && left.length === 0 ? true : `filas creadas: ${left.length}; ${denied(r)}`;
});
await check("1b. authenticated no puede cambiar su ID", async () => {
  const r = await user.from("player_tcg_ids").update({ tcg_user_id: "888" }).eq("id", a.tcgRowId);
  const value = await tcgValue(a.tcgRowId);
  if (value !== "111") await svc.from("player_tcg_ids").update({ tcg_user_id: "111" }).eq("id", a.tcgRowId);
  return denied(r) === true && value === "111" ? true : `valor: ${value}; ${denied(r)}`;
});

// ---------- Lectura ----------
await check("2a. authenticated lee su propia fila", async () => {
  const r = await user.from("player_tcg_ids").select("id").eq("player_id", a.id);
  return !r.error && r.data?.length === 1 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});
await check("2b. authenticated no lee filas ajenas", async () => {
  const r = await user.from("player_tcg_ids").select("id").eq("player_id", b.id);
  return !r.error && r.data?.length === 0 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});
await check("2c. anon no lee filas", async () => {
  const r = await anon().from("player_tcg_ids").select("id").in("player_id", [a.id, b.id]);
  return !r.error && r.data?.length === 0 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});

// ---------- recompute_player_achievements ----------
const recompute = { p_player_id: b.id };
await check("3a. anon no puede ejecutar recompute", async () =>
  denied(await anon().rpc("recompute_player_achievements", recompute)));
await check("3b. authenticated no puede ejecutar recompute", async () =>
  denied(await user.rpc("recompute_player_achievements", recompute)));
await check("3c. service_role sí puede ejecutar recompute", async () => {
  const r = await svc.rpc("recompute_player_achievements", recompute);
  return r.error ? `error: ${r.error.message}` : true;
});

// ---------- Rutas legítimas ----------
await check("4a. assign_tcg_id fusiona un placeholder y mueve sus resultados", async () => {
  const ph = await insertOne("players", { geek_tag: `${TAG}ph`, role: "player", is_active: true });
  await insertOne("player_tcg_ids", { player_id: ph.id, game_id: g2, tcg_user_id: "333" });
  const t = await insertOne("tournaments", {
    store_id: store, game_id: g2, tournament_date: "2026-09-01",
    qualifying_year: 2026, qualifying_month: 9, qualifying_semester: 2, status: "PUBLISHED",
  });
  await insertOne("tournament_results", { tournament_id: t.id, player_id: ph.id, rank: 1, points_earned: 10 });
  // El recálculo corre dentro de la fusión: sin permiso, esta RPC falla entera.
  const r = await svc.rpc("assign_tcg_id", { p_player_id: b.id, p_game_id: g2, p_tcg_user_id: "00333" });
  if (r.error) return `error: ${r.error.message}`;
  const owner = await rows(svc.from("tournament_results").select("player_id").eq("tournament_id", t.id).single());
  return r.data === 1 && owner.player_id === b.id ? true : `merged=${r.data} dueño=${owner.player_id}`;
});
await check("4b. assign_tcg_id rechaza el ID de otra cuenta real", async () => {
  const r = await svc.rpc("assign_tcg_id", { p_player_id: a.id, p_game_id: g1, p_tcg_user_id: "222" });
  return r.error?.message === "TCG_ID_TAKEN" ? true : `recibió ${JSON.stringify(r.error ?? r.data)}`;
});

// Al final: antes del cierre este borrado sí ocurre y dejaría sin fila a los casos de arriba.
await check("1c. authenticated no puede borrar su ID", async () => {
  const r = await user.from("player_tcg_ids").delete().eq("id", a.tcgRowId);
  const value = await tcgValue(a.tcgRowId);
  return denied(r) === true && value === "111" ? true : `valor: ${value}; ${denied(r)}`;
});

await cleanup();
const leftovers = await rows(svc.from("players").select("id").like("geek_tag", "zzhard%"));
results.push({ ok: leftovers.length === 0, name: "limpieza: sin datos de prueba", detail: `${leftovers.length} restantes` });

for (const r of results) console.log(`${r.ok ? "✔" : "✘"} ${r.name}${r.detail ? `  →  ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
