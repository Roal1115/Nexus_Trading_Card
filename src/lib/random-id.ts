// crypto.randomUUID() only exists in secure contexts (https, or localhost) — falls back to a
// Math.random()-based UUID v4 (e.g. LAN IP over http) so callers that insert this into a
// Postgres `uuid` column (see TournamentUploadForm) still get a validly-shaped id.
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
