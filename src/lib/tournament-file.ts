// `tournaments.csv_url` guarda la ruta del archivo en el bucket privado. Los torneos viejos
// aún pueden tener un enlace firmado completo, así que aquí se aceptan ambas formas.
const PATH_RE =
  /^tournaments\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(csv|xls|xlsx)$/i;

export function tournamentFilePath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const signed = stored.match(/\/tournament-files\/([^?]+)/);
  let path = stored;
  try {
    if (signed) path = decodeURIComponent(signed[1]);
  } catch {
    return null; // codificación inválida
  }
  return PATH_RE.test(path) ? path : null;
}

/** El archivo pertenece al torneo cuyo id va en la ruta: así nadie apunta al de otro torneo. */
export function tournamentIdOfFile(path: string): string | null {
  return path.match(PATH_RE)?.[1]?.toLowerCase() ?? null;
}
