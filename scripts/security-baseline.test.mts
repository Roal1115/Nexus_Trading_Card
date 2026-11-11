// Regresión de la línea base de permisos contra el proyecto de PRUEBAS
// (nexus-admin-test). Nunca contra producción.
// Lee NEXUS_URL, NEXUS_SERVICE_ROLE_KEY y NEXUS_ANON_KEY de .env.test.
//   npx tsx scripts/security-baseline.test.mts
// Crea y borra datos con prefijo "zzbase"; no toca el esquema.
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
const denied = (r: { error: { code?: string } | null }) =>
  r.error?.code === "42501" ? true : `esperaba 42501, recibió ${JSON.stringify(r.error) ?? "éxito"}`;

const TAG = `zzbase${Date.now().toString(36)}`;
const cleanupUsers: string[] = [];
async function cleanup() {
  await svc.from("push_subscriptions").delete().like("endpoint", "https://zzbase%");
  const stores = await rows(svc.from("stores").select("id").like("slug", "zzbase%"));
  const ts = await rows(svc.from("tournaments").select("id").in("store_id", stores.map((s: any) => s.id)));
  await svc.from("tournament_results").delete().in("tournament_id", ts.map((t: any) => t.id));
  await svc.from("tournaments").delete().in("id", ts.map((t: any) => t.id));
  const files = await svc.storage.from("league-assets").list(TAG);
  await svc.storage.from("league-assets").remove((files.data ?? []).map((f) => `${TAG}/${f.name}`));
  await svc.from("players").delete().like("geek_tag", "zzbase%");
  await svc.from("games").delete().like("slug", "zzbase%");
  await svc.from("stores").delete().like("slug", "zzbase%");
  for (const id of cleanupUsers) await svc.auth.admin.deleteUser(id).catch(() => {});
}

const insertOne = (table: string, row: Record<string, unknown>) =>
  rows(svc.from(table).insert(row).select("id").single());

async function account(suffix: string) {
  const email = `${TAG}${suffix}@example.test`;
  const password = randomUUID();
  const { data, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { geek_tag: `${TAG}${suffix}` },
  });
  if (error) throw new Error(error.message);
  cleanupUsers.push(data.user.id);
  const player = await rows(svc.from("players").select("id").eq("auth_user_id", data.user.id).single());
  return { id: player.id as string, authId: data.user.id, email, password };
}
const notify = (playerId: string) =>
  insertOne("notifications", { player_id: playerId, type: "schedule_changed", title: "original", body: "b" });

const game = (await insertOne("games", { slug: `${TAG}-g`, name: `${TAG} g` })).id as string;
const store = (await insertOne("stores", { slug: `${TAG}-s`, name: `${TAG} s`, city: "Monterrey" })).id as string;
const a = await account("a");
const b = await account("b");
const noteA = (await notify(a.id)).id as string;
const noteB = (await notify(b.id)).id as string;

const user = anon();
const signIn = await user.auth.signInWithPassword({ email: a.email, password: a.password });
if (signIn.error) throw new Error(signIn.error.message);
const note = (id: string) => rows(svc.from("notifications").select("title, read_at").eq("id", id).single());

// ---------- Lo que el navegador sí usa ----------
await check("1a. anon lee juegos", async () => {
  const r = await anon().from("games").select("id").eq("id", game);
  return !r.error && r.data?.length === 1 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});
await check("1b. authenticated lee su jugador", async () => {
  const r = await user.from("players").select("id, role").eq("id", a.id);
  return !r.error && r.data?.length === 1 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});
await check("1c. authenticated lee sus notificaciones", async () => {
  const r = await user.from("notifications").select("id").eq("id", noteA);
  return !r.error && r.data?.length === 1 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});
await check("1d. authenticated marca como leída su notificación", async () => {
  const r = await user.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", noteA).is("read_at", null);
  const n = await note(noteA);
  return !r.error && n.read_at ? true : `error=${r.error?.code} read_at=${n.read_at}`;
});
const endpoint = `https://zzbase.example/${TAG}`;
const subscribe = () =>
  user.from("push_subscriptions").upsert(
    { endpoint, p256dh: "k", auth: "a" },
    { onConflict: "endpoint", ignoreDuplicates: true },
  );
await check("1e. authenticated activa push, también dos veces", async () => {
  const first = await subscribe();
  const second = await subscribe();
  const saved = await rows(svc.from("push_subscriptions").select("user_id").eq("endpoint", endpoint));
  return !first.error && !second.error && saved.length === 1 && saved[0].user_id === a.authId
    ? true
    : `errores=${first.error?.code}/${second.error?.code} filas=${saved.length}`;
});
await check("1f. authenticated desactiva push", async () => {
  const r = await user.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const saved = await rows(svc.from("push_subscriptions").select("id").eq("endpoint", endpoint));
  return !r.error && saved.length === 0 ? true : `error=${r.error?.code} filas=${saved.length}`;
});

// ---------- Lo que queda cerrado ----------
await check("2a. authenticated no cambia el texto de su notificación", async () => {
  const r = await user.from("notifications").update({ title: "falso" }).eq("id", noteA);
  const n = await note(noteA);
  return denied(r) === true && n.title === "original" ? true : `título=${n.title}; ${denied(r)}`;
});
await check("2b. authenticated no marca notificaciones ajenas", async () => {
  await user.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", noteB);
  const n = await note(noteB);
  return n.read_at === null ? true : `read_at=${n.read_at}`;
});
await check("2c. authenticated no crea notificaciones", async () =>
  denied(await user.from("notifications").insert({ player_id: a.id, type: "schedule_changed", title: "x", body: "x" })));
await check("2d. anon no se suscribe a push", async () =>
  denied(await anon().from("push_subscriptions").insert({ endpoint: `${endpoint}/anon`, p256dh: "k", auth: "a", user_id: a.authId })));
await check("2e. authenticated no escribe favoritos directo", async () =>
  denied(await user.from("player_favorite_stores").insert({ player_id: a.id, store_id: store })));
await check("2f. authenticated no cambia tiendas", async () =>
  denied(await user.from("stores").update({ name: "falso" }).eq("id", store)));
await check("2g. authenticated no borra juegos", async () =>
  denied(await user.from("games").delete().eq("id", game)));
await check("2h. anon no cambia tiendas", async () =>
  denied(await anon().from("stores").update({ name: "falso" }).eq("id", store)));
await check("2i. authenticated no se cambia el rol", async () => {
  const r = await user.from("players").update({ role: "admin" }).eq("id", a.id);
  const p = await rows(svc.from("players").select("role").eq("id", a.id).single());
  return denied(r) === true && p.role === "player" ? true : `rol=${p.role}; ${denied(r)}`;
});

// ---------- Limpieza final ----------
const tournamentWith = async (status: string, day: string) => {
  const t = await insertOne("tournaments", {
    store_id: store, game_id: game, tournament_date: day,
    qualifying_year: 2026, qualifying_month: 9, qualifying_semester: 2, status,
  });
  await insertOne("tournament_results", { tournament_id: t.id, player_id: a.id, rank: 1, points_earned: 3 });
  return t.id as string;
};
const published = await tournamentWith("PUBLISHED", "2026-09-01");
const draft = await tournamentWith("DRAFT", "2026-09-02");
await check("4a. anon lee resultados publicados", async () => {
  const r = await anon().from("tournament_results").select("id").eq("tournament_id", published);
  return !r.error && r.data?.length === 1 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});
await check("4b. anon no lee resultados sin publicar", async () => {
  const r = await anon().from("tournament_results").select("id").eq("tournament_id", draft);
  return !r.error && r.data?.length === 0 ? true : `error=${r.error?.code} filas=${r.data?.length}`;
});
await check("4c. anon no ejecuta increment_sponsor_view", async () =>
  denied(await anon().rpc("increment_sponsor_view", { p_sponsor_id: randomUUID() })));
await check("4d. service_role conserva increment_sponsor_view", async () => {
  const r = await svc.rpc("increment_sponsor_view", { p_sponsor_id: randomUUID() });
  return r.error?.code === "42501" ? `sin permiso: ${r.error.message}` : true;
});
const upload = (name: string, type: string) =>
  svc.storage.from("league-assets").upload(`${TAG}/${name}`, new Blob(["x"], { type }), { contentType: type });
await check("4e. league-assets rechaza SVG y HTML", async () => {
  const svg = await upload("a.svg", "image/svg+xml");
  const html = await upload("a.html", "text/html");
  return svg.error && html.error ? true : `svg=${svg.error ? "rechazado" : "aceptado"} html=${html.error ? "rechazado" : "aceptado"}`;
});
await check("4f. league-assets acepta imágenes", async () => {
  const r = await upload("a.png", "image/png");
  return r.error ? `error: ${r.error.message}` : true;
});

// ---------- El servidor sigue igual ----------
await check("3a. service_role sigue escribiendo", async () => {
  const r = await svc.from("stores").update({ city: "Saltillo" }).eq("id", store);
  return r.error ? `error: ${r.error.message}` : true;
});

await cleanup();
const leftovers = await rows(svc.from("players").select("id").like("geek_tag", "zzbase%"));
results.push({ ok: leftovers.length === 0, name: "limpieza: sin datos de prueba", detail: `${leftovers.length} restantes` });

for (const r of results) console.log(`${r.ok ? "✔" : "✘"} ${r.name}${r.detail ? `  →  ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
