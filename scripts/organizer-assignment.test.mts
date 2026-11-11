// Pruebas del Hallazgo 1 (registro de organizer) contra el proyecto de PRUEBAS (nexus-admin-test).
// Nunca contra producción. Lee NEXUS_URL, NEXUS_SERVICE_ROLE_KEY y NEXUS_ANON_KEY de .env.test.
//   npx tsx scripts/organizer-assignment.test.mts
// Crea y borra datos con prefijo "zzorg"; no toca el esquema.
import fs from "node:fs";
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
  return data as any[];
};

const TAG = `zzorg${Date.now().toString(36)}`;
const cleanupUsers: string[] = [];
async function cleanup() {
  await svc.from("players").delete().like("geek_tag", "zzorg%");
  for (const id of cleanupUsers) await svc.auth.admin.deleteUser(id).catch(() => {});
}

const store = (await rows(svc.from("stores").select("id").eq("is_active", true).limit(1)))[0];
if (!store) throw new Error("El sandbox no tiene tiendas activas");

// ---------- 1. Código: no hay registro público de organizer ----------
await check("1a. signupStoreOrganizer ya no existe en el código", async () => {
  const src = fs.readFileSync(new URL("../src/lib/nexus-organizer-stores.functions.ts", import.meta.url), "utf8");
  return /signupStoreOrganizer/.test(src) ? "sigue exportado" : true;
});
await check("1b. la ruta /organizer-signup ya no existe", async () =>
  fs.existsSync(new URL("../src/routes/organizer-signup.tsx", import.meta.url)) ? "el archivo sigue" : true);
await check("1c. la asignación de organizer exige requireNexusAdmin", async () => {
  const dir = new URL("../src/lib/", import.meta.url);
  const need: Array<[string, string]> = [
    ["nexus-admin-players.functions.ts", "upsertStaffMember"],
    ["nexus-admin-players.functions.ts", "setPlayerRole"],
    ["nexus-admin-stores.functions.ts", "assignOrganizerToStore"],
  ];
  for (const [file, fn] of need) {
    const src = fs.readFileSync(new URL(file, dir), "utf8");
    const m = src.match(new RegExp(`export const ${fn} = createServerFn\\(\\{[^}]*\\}\\)\\s*\\.middleware\\(\\[(\\w+)\\]\\)`));
    if (!m || m[1] !== "requireNexusAdmin") return `${fn} no está protegida por requireNexusAdmin`;
  }
  return true;
});
await check("1d. ninguna server fn sin middleware escribe role organizer/admin", async () => {
  const dir = new URL("../src/lib/", import.meta.url);
  const bad: string[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => /\.functions\.ts$/.test(x))) {
    const src = fs.readFileSync(new URL(f, dir), "utf8");
    const parts = src.split(/(?=export const \w+ = createServerFn)/);
    for (const p of parts.slice(1)) {
      if (!/\.middleware\(/.test(p.split(".handler(")[0]) && /role:\s*"(organizer|admin|tcg_manager)"/.test(p)) {
        bad.push(`${f}:${p.match(/export const (\w+)/)![1]}`);
      }
    }
  }
  return bad.length ? `sin middleware: ${bad.join(", ")}` : true;
});

// ---------- 2. Anónimo ----------
await check("2a. anon no puede insertar un player con role organizer", async () => {
  await anon().from("players").insert({ geek_tag: `${TAG}a`, role: "organizer", home_store_id: store.id });
  const found = await rows(svc.from("players").select("id").eq("geek_tag", `${TAG}a`));
  return found.length === 0 ? true : "se creó el player";
});
await check("2b. anon no puede elevar ni reasignar un player existente", async () => {
  const [p] = await rows(svc.from("players").insert({ geek_tag: `${TAG}b`, role: "player" }).select("id"));
  await anon().from("players").update({ role: "organizer", home_store_id: store.id }).eq("id", p.id);
  const [after] = await rows(svc.from("players").select("role, home_store_id").eq("id", p.id));
  return after.role === "player" && after.home_store_id === null ? true : `quedó ${after.role}/${after.home_store_id}`;
});
await check("2c. signUp directo con role/home_store_id en el metadata no da organizer", async () => {
  const email = `${TAG}c@example.com`;
  const { data, error } = await anon().auth.signUp({
    email,
    password: "Zz-test-1234567",
    options: { data: { geek_tag: `${TAG}c`, role: "organizer", home_store_id: store.id } },
  });
  if (error) return true; // registro público de Auth deshabilitado: tampoco hay vector
  if (data.user) cleanupUsers.push(data.user.id);
  const found = await rows(svc.from("players").select("role, home_store_id").eq("email", email));
  const bad = found.find((r) => r.role !== "player" || r.home_store_id !== null);
  return bad ? `quedó ${bad.role}/${bad.home_store_id}` : true;
});

// ---------- 3. Jugador autenticado ----------
await check("3. un jugador no puede cambiarse role ni home_store_id", async () => {
  const email = `${TAG}d@example.com`;
  const password = "Zz-test-1234567";
  const { data: u, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { geek_tag: `${TAG}d` },
  });
  if (error || !u.user) throw new Error(error?.message ?? "createUser");
  cleanupUsers.push(u.user.id);
  const client = anon();
  const { error: se } = await client.auth.signInWithPassword({ email, password });
  if (se) throw new Error(se.message);
  const [me] = await rows(svc.from("players").select("id, role, home_store_id").eq("auth_user_id", u.user.id));
  await client.from("players").update({ role: "organizer", home_store_id: store.id }).eq("id", me.id);
  await client.from("players").update({ role: "admin" }).eq("id", me.id);
  const [after] = await rows(svc.from("players").select("role, home_store_id").eq("id", me.id));
  return after.role === "player" && after.home_store_id === null
    ? true
    : `el jugador quedó ${after.role}/${after.home_store_id} (¿falta aplicar la Fase 0 en este proyecto?)`;
});

// ---------- 4. Asignación legítima por admin (misma secuencia de datos que las server fns) ----------
await check("4. el flujo de admin deja un organizer ligado a su tienda", async () => {
  // upsertStaffMember (cuenta nueva) + assignOrganizerToStore, con service_role como en las server fns.
  const email = `${TAG}e@example.com`;
  const { data: u, error } = await svc.auth.admin.createUser({
    email, password: "Zz-temp-1234567", email_confirm: true, user_metadata: { geek_tag: `${TAG}e` },
  });
  if (error || !u.user) throw new Error(error?.message ?? "createUser");
  cleanupUsers.push(u.user.id);
  const [p] = await rows(svc.from("players").select("id").eq("auth_user_id", u.user.id));
  await rows(svc.from("players").update({ role: "organizer", is_active: true }).eq("id", p.id).select("id"));
  await rows(svc.from("players").update({ home_store_id: store.id }).eq("id", p.id).select("id"));
  const [after] = await rows(svc.from("players").select("role, home_store_id").eq("id", p.id));
  return after.role === "organizer" && after.home_store_id === store.id ? true : `quedó ${after.role}/${after.home_store_id}`;
});

// ---------- 5. Contraseña temporal criptográficamente segura ----------
const srv = await import("../src/lib/nexus-admin.server.ts");
await check("5a. upsertStaffMember ya no usa Math.random", async () => {
  const src = fs.readFileSync(new URL("../src/lib/nexus-admin-players.functions.ts", import.meta.url), "utf8");
  if (/Math\.random/.test(src)) return "sigue usando Math.random";
  return /generateTempPassword\(\)/.test(src) ? true : "no usa generateTempPassword";
});
await check("5b. generateTempPassword: 28 chars, 4 clases, sin repetidos en 5000 muestras", async () => {
  const seen = new Set<string>();
  for (let i = 0; i < 5000; i++) {
    const p = srv.generateTempPassword();
    if (p.length !== 28) return `longitud ${p.length}`;
    if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p)) return `falta una clase: ${p}`;
    seen.add(p);
  }
  return seen.size === 5000 ? true : `${5000 - seen.size} repetidas`;
});
await check("5c. generateTempPassword: distribución uniforme del alfabeto (sin sesgo evidente)", async () => {
  const counts = new Map<string, number>();
  let total = 0;
  for (let i = 0; i < 4000; i++) {
    for (const ch of srv.generateTempPassword().slice(0, 24)) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
      total++;
    }
  }
  const expected = total / counts.size;
  const worst = Math.max(...[...counts.values()].map((c) => Math.abs(c - expected) / expected));
  return counts.size === 56 && worst < 0.1 ? true : `${counts.size} símbolos, desviación máxima ${(worst * 100).toFixed(1)}%`;
});

// ---------- 6. assignOrganizerToStore no desliga a jugadores comunes ----------
await check("6. clearOtherStoreOrganizers solo desliga a OTROS organizers", async () => {
  const mk = async (suffix: string, role: string) =>
    (await rows(svc.from("players").insert({ geek_tag: `${TAG}${suffix}`, role, home_store_id: store.id }).select("id")))[0].id as string;
  const target = await mk("t", "organizer");
  const otherOrg = await mk("o", "organizer");
  const normal = await mk("n", "player");
  const manager = await mk("m", "tcg_manager");
  const adminP = await mk("a", "admin");
  const { error } = await srv.clearOtherStoreOrganizers(svc as any, store.id, target);
  if (error) throw new Error(error.message);
  const get = async (id: string) => (await rows(svc.from("players").select("home_store_id").eq("id", id)))[0].home_store_id;
  const got = { target: await get(target), otherOrg: await get(otherOrg), normal: await get(normal), manager: await get(manager), admin: await get(adminP) };
  const ok = got.target === store.id && got.otherOrg === null && got.normal === store.id && got.manager === store.id && got.admin === store.id;
  return ok ? true : `estado: ${JSON.stringify(got)}`;
});

await cleanup();
const leftovers = await rows(svc.from("players").select("id").like("geek_tag", "zzorg%"));
results.push({ ok: leftovers.length === 0, name: "limpieza: sin datos de prueba", detail: `${leftovers.length} restantes` });

for (const r of results) console.log(`${r.ok ? "✔" : "✘"} ${r.name}${r.detail ? `  →  ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
