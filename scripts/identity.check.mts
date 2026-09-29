// Regresión de identidad de jugadores One Piece: el Bandai ID es la identidad canónica.
// Solo contra el proyecto de PRUEBAS (nexus-admin-test). Lee .env.test.
//   npx tsx scripts/identity.check.mts
// Los casos que necesitan una cuenta real (auth.users) están en scripts/identity.check.sql.
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
const { resolvePlayer, ONE_PIECE_SLUG } = await import("../src/lib/player-identity.server.ts");
const admin = getNexusAdmin();

async function q<T = any>(p: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const P = "IDT·"; // prefijo de todo jugador de prueba
const game = await q(admin.from("games").upsert({ slug: ONE_PIECE_SLUG, name: "One Piece Card Game" }, { onConflict: "slug" }).select("id").single());
const store = await q(admin.from("stores").upsert({ slug: "tienda-prueba", name: "Tienda Prueba", city: "Monterrey" }, { onConflict: "slug" }).select("id").single());
const G = game.id as string;

async function reset() {
  const ts = await q<{ id: string }[]>(admin.from("tournaments").select("id").eq("game_id", G));
  if (ts.length) {
    await q(admin.from("tournament_results").delete().in("tournament_id", ts.map((t) => t.id)));
    await q(admin.from("tournaments").delete().in("id", ts.map((t) => t.id)));
  }
  await q(admin.from("players").delete().like("geek_tag", `${P}%`));
}
// Igual que uploadTournamentResults: trim del nombre y del ID antes de resolver.
const importRow = (name: string, id: string | null) =>
  resolvePlayer(admin, `${P}${name}`.trim(), id ? id.trim() || null : null, G, true);
async function player(name: string, id: string | null) {
  const p = await q(admin.from("players").insert({ geek_tag: `${P}${name}`, role: "player", is_active: true }).select("id").single());
  if (id !== null) await q(admin.from("player_tcg_ids").insert({ player_id: p.id, game_id: G, tcg_user_id: id }));
  return p.id as string;
}
async function holders(norm: string, gameId = G) {
  return (await q<{ player_id: string }[]>(admin.from("player_tcg_ids").select("player_id").eq("game_id", gameId).eq("tcg_user_id_normalized", norm))).map((r) => r.player_id);
}
const tag = async (id: string) => ((await q(admin.from("players").select("geek_tag").eq("id", id).maybeSingle())) as any)?.geek_tag?.replace(P, "") ?? "(borrado)";
const count = async (like: string) => (await q<any[]>(admin.from("players").select("id").like("geek_tag", `${P}${like}`))).length;
let day = 1;
async function tournamentWith(playerId: string) {
  const t = await q(admin.from("tournaments").insert({
    store_id: store.id, game_id: G, tournament_date: `2026-08-${String(day++).padStart(2, "0")}`,
    qualifying_year: 2026, qualifying_month: 8, qualifying_semester: 2, status: "DRAFT",
  }).select("id").single());
  await q(admin.from("tournament_results").insert({ tournament_id: t.id, player_id: playerId, rank: 1, points_earned: 3 }));
  return t.id as string;
}
const assign = (playerId: string, id: string) =>
  admin.rpc("assign_tcg_id" as any, { p_player_id: playerId, p_game_id: G, p_tcg_user_id: id });

const results: Array<{ ok: string; scenario: string; expected: string; actual: string }> = [];
async function check(scenario: string, expected: string, fn: () => Promise<string>) {
  let actual: string;
  try { actual = await fn(); } catch (e) { actual = `ERROR ${(e as Error).message}`; }
  results.push({ ok: actual === expected ? "✔" : "✘", scenario, expected, actual });
}

// ---------- Resolución con ID existente ----------
await reset();
let real = await player("Jugador AB", "123");

await check("1 mismo nombre + mismo ID", "same=true new=false holders=1", async () => {
  const r = await importRow("Jugador AB", "123");
  return `same=${r.id === real} new=${r.isNew} holders=${(await holders("123")).length}`;
});
for (const n of ["JugadorA", "Jugador A", "Jugador B", "Jugador C", "Jesús", "JESUS", "jesus", "TotallyDifferentName"]) {
  await check(`2/9 otro nombre "${n}" + mismo ID`, "same=true new=false", async () => {
    const r = await importRow(n, "123");
    return `same=${r.id === real} new=${r.isNew}`;
  });
}
await check("2/9 ningún jugador nuevo ni ID duplicado", "players=1 holders=1", async () =>
  `players=${await count("%")} holders=${(await holders("123")).length}`);

for (const v of ["123", " 123 ", "00123", "0123"]) {
  await check(`11-14 normalización ${JSON.stringify(v)}`, "same=true new=false", async () => {
    const r = await importRow("JugadorA", v);
    return `same=${r.id === real} new=${r.isNew}`;
  });
}

await check("3 mismo nombre + ID distinto (789) → otra persona", "new=true notReal=true tag=Jugador AB #789 holders789=1", async () => {
  const r = await importRow("Jugador AB", "789");
  return `new=${r.isNew} notReal=${r.id !== real} tag=${await tag(r.id)} holders789=${(await holders("789")).length}`;
});
await check("3b el ID 789 se vuelve a resolver al mismo placeholder", "same=true", async () => {
  const a = (await holders("789"))[0];
  const r = await importRow("OtroNombre", "0789");
  return `same=${r.id === a}`;
});
await check("4 nombre distinto + ID distinto (456)", "new=true notReal=true holders456=1", async () => {
  const r = await importRow("JugadorA", "456");
  return `new=${r.isNew} notReal=${r.id !== real} holders456=${(await holders("456")).length}`;
});
await check("10 mismo nombre 'Jesús', IDs 123 vs 456 → distintos", "different=true", async () => {
  const a = await importRow("Jesús", "123");
  const b = await importRow("Jesús", "456");
  return `different=${a.id !== b.id}`;
});

// ---------- Sin ID: invitado, nunca por nombre ----------
let guest1 = "";
await check("5a sin ID con el nombre exacto de la cuenta → invitado, no la cuenta", "notReal=true new=true tcgRows=0", async () => {
  const r = await importRow("Jugador AB", null);
  guest1 = r.id;
  return `notReal=${r.id !== real} new=${r.isNew} tcgRows=${(await q<any[]>(admin.from("player_tcg_ids").select("id").eq("player_id", r.id))).length}`;
});
await check("5b mismo nombre sin ID otra vez → otro invitado (el nombre no identifica)", "notReal=true notGuest1=true new=true", async () => {
  const r = await importRow("Jugador AB", null);
  return `notReal=${r.id !== real} notGuest1=${r.id !== guest1} new=${r.isNew}`;
});
await check("5c los invitados no tocan la identidad 123", "holders=1 owner=real", async () => {
  const h = await holders("123");
  return `holders=${h.length} owner=${h[0] === real ? "real" : h[0]}`;
});

// ---------- Renombrar ----------
await check("8 renombrar cuenta a 'Jugador ABC' e importar 'JugadorA'/123", "same=true tag=Jugador ABC", async () => {
  await q(admin.from("players").update({ geek_tag: `${P}Jugador ABC` }).eq("id", real));
  const r = await importRow("JugadorA", "123");
  return `same=${r.id === real} tag=${await tag(r.id)}`;
});

// ---------- Placeholder → cuenta real, y torneos futuros ----------
await reset();
const ph = await importRow("JugadorA", "123");
const tHist = await tournamentWith(ph.id);
real = await player("Jugador AB", null); // cuenta que se registra después con 00123
await check("6 cuenta registra 00123 → absorbe placeholder", "merged=1 holders=1 phGone=true histOwner=real", async () => {
  const { data, error } = await assign(real, "00123");
  if (error) throw new Error(error.message);
  const owner = (await q(admin.from("tournament_results").select("player_id").eq("tournament_id", tHist).single())).player_id;
  const hs = await holders("123");
  return `merged=${data} holders=${hs.length} phGone=${(await tag(ph.id)) === "(borrado)"} histOwner=${owner === real ? "real" : owner}`;
});
await check("7 torneos futuros con 5 nombres distintos /123 → misma cuenta", "allReal=true players=1 holders=1 results=6", async () => {
  const names = ["Jugador A", "Jugador B", "Jugador C", "Jesús", "RandomTournamentName"];
  const ids = [];
  for (const n of names) {
    const r = await importRow(n, "123");
    ids.push(r.id);
    await tournamentWith(r.id);
  }
  const res = await q<any[]>(admin.from("tournament_results").select("id").eq("player_id", real));
  return `allReal=${ids.every((i) => i === real)} players=${await count("%")} holders=${(await holders("123")).length} results=${res.length}`;
});

// ---------- Integridad en BD ----------
await check("15 insertar duplicado (game, '0123') directo → rechazado", "23505", async () => {
  const other = await player("Intruso", null);
  const { error } = await admin.from("player_tcg_ids").insert({ player_id: other, game_id: G, tcg_user_id: "0123" });
  return error?.code ?? "sin error (MAL)";
});
await check("17 claim_tcg_placeholders sigue disponible (0 por el UNIQUE)", "0", async () => {
  const { data, error } = await admin.rpc("claim_tcg_placeholders" as any, { p_player_id: real });
  if (error) throw new Error(error.message);
  return String(data);
});
// ---------- Carrera ----------
await check("16 dos uploads simultáneos del ID nuevo 999 (nombres distintos)", "sameId=true holders=1 players=1", async () => {
  const [a, b] = await Promise.all([importRow("Carrera A", "999"), importRow("Carrera B", "999")]);
  return `sameId=${a.id === b.id} holders=${(await holders("999")).length} players=${await count("Carrera%")}`;
});
await check("16b dos uploads simultáneos, mismo nombre y mismo ID nuevo 998", "sameId=true holders=1 players=1", async () => {
  const [a, b] = await Promise.all([importRow("Gemelo", "998"), importRow("Gemelo", "998")]);
  return `sameId=${a.id === b.id} holders=${(await holders("998")).length} players=${await count("Gemelo%")}`;
});
await check("16c ocho uploads simultáneos del ID nuevo 997", "distinct=1 holders=1 players=1", async () => {
  const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => importRow(`Ráfaga ${i}`, "997")));
  return `distinct=${new Set(rs.map((r) => r.id)).size} holders=${(await holders("997")).length} players=${await count("Ráfaga%")}`;
});

await reset();
console.table(results);
const failed = results.filter((r) => r.ok !== "✔").length;
console.log(failed ? `${failed} FALLARON` : `Todos pasaron (${results.length})`);
process.exit(failed ? 1 : 0);
