// Rutas de archivos de torneo: npx tsx scripts/tournament-file.check.mts
import assert from "node:assert/strict";
import { tournamentFilePath, tournamentIdOfFile } from "../src/lib/tournament-file.ts";

const id = "6686e1df-5641-45b0-b66c-0eaa84557e3a";
const path = `tournaments/${id}.csv`;

assert.equal(tournamentFilePath(path), path);
assert.equal(tournamentFilePath(`tournaments/${id}.xlsx`), `tournaments/${id}.xlsx`);
// Enlace firmado viejo.
assert.equal(
  tournamentFilePath(
    `https://x.supabase.co/storage/v1/object/sign/tournament-files/${path}?token=abc.def`,
  ),
  path,
);
assert.equal(tournamentIdOfFile(path), id);

for (const bad of [
  null,
  undefined,
  "",
  "https://evil.example/archivo.csv",
  "../secret.csv",
  `tournaments/../${id}.csv`,
  `otros/${id}.csv`,
  `tournaments/${id}.exe`,
  "tournaments/no-es-uuid.csv",
  "https://x.supabase.co/object/sign/tournament-files/%E0%A4%A?token=a", // codificación rota
  `https://x.supabase.co/storage/v1/object/sign/tournament-files/..%2F${id}.csv?token=a`,
]) {
  assert.equal(tournamentFilePath(bad), null, String(bad));
}

console.log("tournament-file: ok");
