// Reglas de invitación de tiendas: npx tsx scripts/store-invite-rules.check.mts
import assert from "node:assert/strict";
import { hashInviteToken, newInviteToken, storeTagBase } from "../src/lib/store-invite-rules.ts";
import { TAG_RE } from "../src/lib/nexus-tag.ts";

assert.equal(storeTagBase("Planeta de Héroes Mty"), "PlanetadeHeroesMty");
assert.equal(storeTagBase("Geek-Collector!"), "GeekCollector");
assert.equal(storeTagBase("TC"), "TiendaTC"); // muy corto
assert.equal(storeTagBase("日本"), "Tienda"); // sin letras latinas
for (const name of ["Ñandú & Cía.", "x".repeat(200), "  a  "]) {
  assert.ok(TAG_RE.test(storeTagBase(name)), name);
  assert.ok(TAG_RE.test(`${storeTagBase(name)}1234`), name); // con sufijo cabe en 30
}

const token = newInviteToken();
assert.equal(token.length, 64);
assert.notEqual(token, newInviteToken());
const hash = await hashInviteToken(token);
assert.equal(hash.length, 64);
assert.notEqual(hash, token);
assert.equal(hash, await hashInviteToken(token));

console.log("store-invite-rules: ok");
