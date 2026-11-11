// Reglas de invitación de tiendas: npx tsx scripts/store-invite-rules.check.mts
import assert from "node:assert/strict";
import { decryptInviteToken, encryptInviteToken, hashInviteToken, isGoogleMapsUrl, newInviteToken, storeTagBase, subzoneIsValid } from "../src/lib/store-invite-rules.ts";
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

// Enlace de Google Maps: largo, corto y dominios que solo lo aparentan.
for (const ok of [
  "https://maps.app.goo.gl/abc123",
  "https://www.google.com/maps/place/Tienda",
  "https://www.google.com.mx/maps/place/Tienda",
  "https://maps.google.com/?q=25.6,-100.3",
  "https://goo.gl/maps/abc",
]) {
  assert.equal(isGoogleMapsUrl(ok), true, ok);
}
for (const bad of [
  "",
  "tienda",
  "javascript:alert(1)",
  "https://google.com/search?q=x",
  "https://goo.gl/abc",
  "https://maps.app.goo.gl.evil.com/x",
  "https://evil.com/maps",
]) {
  assert.equal(isGoogleMapsUrl(bad), false, bad);
}

// Cifrado de la URL: ida y vuelta, nada legible y clave incorrecta falla.
{
  const token = newInviteToken();
  const stored = await encryptInviteToken(token, "clave-de-prueba");
  assert.ok(!stored.includes(token));
  assert.notEqual(stored, await encryptInviteToken(token, "clave-de-prueba"));
  assert.equal(await decryptInviteToken(stored, "clave-de-prueba"), token);
  await assert.rejects(decryptInviteToken(stored, "otra-clave"));
}

// Subzonas: "No sé" siempre vale; la subzona debe ser de esa zona.
{
  const zones = [
    { name: "Mty", subzones: [{ name: "Norte" }] },
    { name: "Gdl", subzones: [] },
  ];
  assert.equal(subzoneIsValid(zones, "Mty", "Norte"), true);
  assert.equal(subzoneIsValid(zones, "Mty", null), true);
  assert.equal(subzoneIsValid(zones, null, null), true);
  assert.equal(subzoneIsValid(zones, "Gdl", "Norte"), false);
  assert.equal(subzoneIsValid(zones, "Mty", "Sur"), false);
  assert.equal(subzoneIsValid(zones, null, "Norte"), false);
}
