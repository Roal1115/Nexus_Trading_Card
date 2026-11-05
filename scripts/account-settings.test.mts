// Regresión de cambio de contraseña y sincronización de email contra el proyecto de
// PRUEBAS (nexus-admin-test). Nunca contra producción.
// Lee NEXUS_URL, NEXUS_SERVICE_ROLE_KEY y NEXUS_ANON_KEY de .env.test.
//   npx tsx scripts/account-settings.test.mts
// Crea y borra datos con prefijo "zzmail"; no toca el esquema.
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

const TAG = `zzmail${Date.now().toString(36)}`;
const mail = (s: string) => `${TAG}${s}@example.test`;
const cleanupUsers: string[] = [];
async function account(suffix: string) {
  const email = mail(suffix);
  const password = `Zz-${randomUUID()}`;
  const { data, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { geek_tag: `${TAG}${suffix}` },
  });
  if (error) throw new Error(error.message);
  cleanupUsers.push(data.user.id);
  return { id: data.user.id, email, password };
}
const playerEmail = async (authId: string) =>
  (await svc.from("players").select("email").eq("auth_user_id", authId).single()).data?.email;

const a = await account("a");
const b = await account("b");

await check("1a. el usuario cambia su contraseña como en Ajustes", async () => {
  const user = anon();
  const login = await user.auth.signInWithPassword({ email: a.email, password: a.password });
  if (login.error) return `login: ${login.error.message}`;
  const next = `Zz-${randomUUID()}`;
  const r = await user.auth.updateUser({ password: next });
  if (r.error) return `update: ${r.error.message}`;
  const again = await anon().auth.signInWithPassword({ email: a.email, password: next });
  const old = await anon().auth.signInWithPassword({ email: a.email, password: a.password });
  a.password = next;
  return !again.error && old.error ? true : `nueva=${again.error?.message ?? "ok"} vieja=${old.error ? "rechazada" : "aceptada"}`;
});
await check("1b. repetir la contraseña devuelve same_password", async () => {
  const user = anon();
  await user.auth.signInWithPassword({ email: a.email, password: a.password });
  const r = await user.auth.updateUser({ password: a.password });
  return r.error?.code === "same_password" ? true : `code=${r.error?.code}`;
});

await check("2a. cambiar email en auth actualiza players.email", async () => {
  const next = mail("a2");
  const r = await svc.auth.admin.updateUserById(a.id, { email: next, email_confirm: true });
  if (r.error) return `update: ${r.error.message}`;
  const found = await playerEmail(a.id);
  return found === next ? true : `players.email=${found}`;
});
await check("2b. el jugador se encuentra con el email nuevo", async () => {
  const r = await svc.from("players").select("auth_user_id").ilike("email", mail("a2")).maybeSingle();
  return r.data?.auth_user_id === a.id ? true : `error=${r.error?.message} encontrado=${r.data?.auth_user_id}`;
});
await check("2c. puede entrar con el email nuevo", async () => {
  const r = await anon().auth.signInWithPassword({ email: mail("a2"), password: a.password });
  return r.error ? r.error.message : true;
});
await check("2d. cambiar otro dato de auth no toca players.email", async () => {
  await svc.auth.admin.updateUserById(a.id, { user_metadata: { zz: 1 } });
  const found = await playerEmail(a.id);
  return found === mail("a2") ? true : `players.email=${found}`;
});
await check("2e. un email ya usado por un jugador sin cuenta se rechaza completo", async () => {
  const taken = mail("taken");
  await svc.from("players").insert({ geek_tag: `${TAG}ph`, role: "player", is_active: true, email: taken });
  const r = await svc.auth.admin.updateUserById(b.id, { email: taken, email_confirm: true });
  const authEmail = (await svc.auth.admin.getUserById(b.id)).data.user?.email;
  const found = await playerEmail(b.id);
  return r.error && authEmail === b.email && found === b.email
    ? true
    : `error=${r.error?.message ?? "ninguno"} auth=${authEmail} players=${found}`;
});

await svc.from("players").delete().like("geek_tag", "zzmail%");
for (const id of cleanupUsers) await svc.auth.admin.deleteUser(id).catch(() => {});
const { data: leftovers } = await svc.from("players").select("id").like("geek_tag", "zzmail%");
results.push({ ok: leftovers?.length === 0, name: "limpieza: sin datos de prueba", detail: `${leftovers?.length} restantes` });

for (const r of results) console.log(`${r.ok ? "✔" : "✘"} ${r.name}${r.detail ? `  →  ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
