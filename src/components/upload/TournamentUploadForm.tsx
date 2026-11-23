import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { mondayOfWeek, toLocalDateStr } from "@/lib/utils";
import { randomId } from "@/lib/random-id";
import { nexus } from "@/integrations/nexus/client";
import {
  getOrganizerOverview,
  listActiveStores,
  lookupPlayerTags,
  uploadTournamentResults,
  getActiveLeaguesForStore,
} from "@/lib/nexus-organizer.functions";

import { getManagerResponsibleStores } from "@/lib/nexus-manager.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { assignLeagues } from "@/lib/league-assignment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  FOCUS_RING,
  INPUT,
  InlineError,
  LABEL,
  SURFACE,
} from "@/components/stores/store-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Game = { id: string; slug: string; name: string };
type Store = { id: string; name: string; city: string | null };

type Platform = "bandai" | "limitless" | "magic" | "unknown";
type ColumnMap = {
  platform: Platform;
  rank?: string;
  nexusTag?: string;
  matchPoints?: string;
  omw?: string;
  record?: string;
  status?: string;
  membershipId?: string;
};

const TCG_COLUMN_MAP: Record<string, ColumnMap> = {
  "one-piece": {
    platform: "bandai",
    rank: "Ranking",
    nexusTag: "User Name",
    matchPoints: "Win Points",
    omw: "OMW %",
    membershipId: "Membership Number",
  },
  "dragon-ball": {
    platform: "bandai",
    rank: "Ranking",
    nexusTag: "User Name",
    matchPoints: "Win Points",
    omw: "OMW %",
    membershipId: "Membership Number",
  },
  gundam: {
    platform: "bandai",
    rank: "Ranking",
    nexusTag: "User Name",
    matchPoints: "Win Points",
    omw: "OMW %",
    membershipId: "Membership Number",
  },
  riftbound: {
    platform: "limitless",
    rank: "Rank",
    nexusTag: "Display Name",
    matchPoints: "Match Points",
    omw: "Opponent Match Win %",
    record: "Record (W-L-D)",
    status: "Registration Status",
    membershipId: "User ID",
  },
  pokemon: { platform: "unknown" },
  "magic-the-gathering": {
    platform: "magic",
    rank: "Puesto",
    nexusTag: "Nombre",
    matchPoints: "Puntos",
    omw: "%VPO",
    record: "V/D/E",
  },
};

// Campo de fecha del sistema (44px en móvil, borde del sistema) con el selector nativo en oscuro.
const DATE_INPUT =
  "min-h-11 border-border sm:min-h-9 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer";

// Un TCG sin formato de importación no se puede elegir para subir resultados.
const isImportable = (g: Game) => (TCG_COLUMN_MAP[g.slug]?.platform ?? "unknown") !== "unknown";

// "Copy Paste Magic" exporta V/D/E (Victorias/Derrotas/Empates) como texto "2/1/0".
// Excel lo interpreta como una fecha mes/día/año y lo corrompe (ej. "2/1/0" -> 01/02/2000).
// Esta función revierte esa corrupción reconstruyendo el triplete original.
function parseVDE(raw: string): {
  wins: number | null;
  losses: number | null;
  draws: number | null;
} {
  const val = raw.trim();
  if (!val) return { wins: null, losses: null, draws: null };

  // Celda XLSX: Date real (ya normalizada a "YYYY-MM-DD" en readFileToRows)
  let m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return { wins: Number(mo), losses: Number(d), draws: Number(y) % 100 };
  }

  // Celda CSV: mismo valor ya corrompido y guardado como texto localizado DD/MM/YYYY
  m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return { wins: Number(mo), losses: Number(d), draws: Number(y) % 100 };
  }

  // Valor sano: el triplete "V/D/E" tal cual lo exportó la herramienta
  const parts = val.split("/").map((p) => Number(p.trim()));
  if (parts.length === 3 && parts.every((n) => isFinite(n))) {
    return { wins: parts[0], losses: parts[1], draws: parts[2] };
  }

  return { wins: null, losses: null, draws: null };
}

function normalizarPuntos(rows: ParsedRow[]): ParsedRow[] {
  // El máximo es el match_points del jugador en rank 1
  const rank1 = rows.find((r) => r.rank === 1);
  const maxPoints = rank1?.match_points ?? 0;

  // Si el máximo es 0 o no existe, no se puede normalizar
  if (maxPoints <= 0) {
    return rows.map((r) => ({ ...r, points_earned: 0 }));
  }

  return rows.map((r) => ({
    ...r,
    points_earned:
      r.match_points != null && r.match_points > 0
        ? Math.round((r.match_points / maxPoints) * 10000) / 100
        : 0,
  }));
}

type ParsedRow = {
  rank: number;
  geek_tag: string;
  membership_id: string | null;
  match_points: number | null;
  omw_percentage: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  points_earned: number;
  dropped: boolean;
  error?: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function parsePct(raw: string | undefined, platform: Platform): number | null {
  if (raw == null || raw === "") return null;
  const cleaned = raw.replace("%", "").trim();
  const n = Number(cleaned);
  if (!isFinite(n)) return null;
  // Limitless typically sends decimals (0.52); Bandai sends percentages (52)
  if (platform === "limitless" && n <= 1) return Math.round(n * 100 * 100) / 100;
  return Math.round(n * 100) / 100;
}

function parseTable(rows: string[][], map: ColumnMap): ParsedRow[] {
  if (rows.length < 2) return [];
  const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());
  const idx = (key: string | undefined) =>
    key ? headers.findIndex((h) => h.toLowerCase() === key.toLowerCase()) : -1;

  const iRank = idx(map.rank);
  const iTag = idx(map.nexusTag);
  const iPts = idx(map.matchPoints);
  const iOmw = idx(map.omw);
  const iRec = idx(map.record);
  const iSt = idx(map.status);
  const iMem = idx(map.membershipId);

  const out: ParsedRow[] = [];
  for (let li = 1; li < rows.length; li++) {
    const cols = (rows[li] ?? []).map((c) => String(c ?? "").trim());
    const tag = (iTag !== -1 ? cols[iTag] : "")?.trim() ?? "";
    if (!tag) continue;

    let wins: number | null = null;
    let losses: number | null = null;
    let draws: number | null = null;
    if (map.platform === "limitless" && iRec !== -1) {
      const parts = (cols[iRec] || "").split("-").map((p) => Number(p.trim()));
      wins = isFinite(parts[0]) ? parts[0] : null;
      losses = isFinite(parts[1]) ? parts[1] : null;
      draws = isFinite(parts[2]) ? parts[2] : 0;
    } else if (map.platform === "magic" && iRec !== -1) {
      const vde = parseVDE(cols[iRec] || "");
      wins = vde.wins;
      losses = vde.losses;
      draws = vde.draws;
    } else if (map.platform === "bandai") {
      draws = 0;
    }

    const rank = iRank !== -1 ? Number(cols[iRank]) : NaN;
    const mp = iPts !== -1 ? Number(cols[iPts]) : NaN;
    const dropped = iSt !== -1 && (cols[iSt] || "").toUpperCase() === "DROPPED";

    let error: string | undefined;
    if (!isFinite(rank) || rank < 1) error = "Ranking inválido";
    else if (!isFinite(mp)) error = "Match Points inválido";

    out.push({
      rank: isFinite(rank) ? rank : 0,
      geek_tag: tag,
      membership_id: iMem !== -1 ? (cols[iMem] || "").trim() || null : null,
      match_points: isFinite(mp) ? mp : null,
      omw_percentage: parsePct(iOmw !== -1 ? cols[iOmw] : undefined, map.platform),
      wins,
      losses,
      draws,
      points_earned: 0,
      dropped,
      error,
    });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

function csvTextToRows(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => splitCsvLine(l));
}

async function readFileToRows(file: File): Promise<string[][]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    const text = await file.text();
    return csvTextToRows(text);
  }
  try {
    const sheets = await readXlsxFile(file);
    const data = sheets[0]?.data ?? [];
    // data is (string | number | boolean | Date | null)[][]
    const rows: string[][] = data.map((row) =>
      row.map((cell) => {
        if (cell == null) return "";
        if (cell instanceof Date) {
          // read-excel-file construye estas fechas en UTC+0 (00:00) — hay que leer
          // los componentes en UTC, si no, en timezones negativos (ej. México)
          // el día se recorre uno hacia atrás.
          const y = cell.getUTCFullYear();
          const mo = String(cell.getUTCMonth() + 1).padStart(2, "0");
          const d = String(cell.getUTCDate()).padStart(2, "0");
          return `${y}-${mo}-${d}`;
        }
        return String(cell);
      }),
    );
    if (rows.length === 0) {
      throw new Error("El archivo no contiene filas con datos.");
    }
    return rows;
  } catch (err) {
    console.error("Error parsing XLSX:", err);
    throw new Error(
      `No se pudo leer el archivo Excel: ${(err as Error).message ?? "formato no soportado"}. Intenta exportarlo de nuevo o usar formato CSV.`,
    );
  }
}

const ALLOWED_EXTENSIONS = ["csv", "xls", "xlsx"];
const ALLOWED_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "", // some browsers report empty mime for csv
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function uploadFileToStorage(file: File, tournamentId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";
    const path = `tournaments/${tournamentId}.${ext}`;
    const { error } = await nexus.storage
      .from("tournament-files")
      // Sin upsert: necesitaría permiso de lectura, y el id del torneo siempre es nuevo.
      .upload(path, file, { contentType: file.type || undefined });
    if (error) {
      console.error("Storage upload error:", error.message);
      return null;
    }
    // Solo la ruta: el enlace se firma al abrirlo, con permisos (ver getTournamentFileUrl).
    return path;
  } catch (e) {
    console.error("Storage error:", e);
    return null;
  }
}

// "16 nov" a partir de YYYY-MM-DD (al mediodía, para que la zona horaria no la corra).
const fmtShortDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

function getWeekDateRange(): { min: string; max: string } {
  const today = new Date();
  return { min: toLocalDateStr(mondayOfWeek(today)), max: toLocalDateStr(today) };
}

export function TournamentUploadForm({
  cancelTo = "/organizer/tournaments",
  successTo = "/organizer/tournaments",
  successSearch,
  gamesOverride,
  initialGameId,
  initialDate,
}: {
  cancelTo?: string;
  successTo?: string;
  successSearch?: Record<string, string>;
  gamesOverride?: Game[];
  // Vienen del torneo atrasado del inicio: el organizador no vuelve a escribirlos.
  initialGameId?: string;
  initialDate?: string;
} = {}) {
  const navigate = useNavigate();
  const { player, loading: roleLoading } = useNexusRole();
  const isAdmin = player?.role === "admin";
  const isManager = player?.role === "tcg_manager";

  const fetchOverview = useServerFn(getOrganizerOverview);
  const fetchStores = useServerFn(listActiveStores);
  const fetchManagerStores = useServerFn(getManagerResponsibleStores);
  const submitUpload = useServerFn(uploadTournamentResults);
  const lookupTags = useServerFn(lookupPlayerTags);
  const fetchActiveLeagues = useServerFn(getActiveLeaguesForStore);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [games, setGames] = useState<Game[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [managerStores, setManagerStores] = useState<(Store & { available_game_ids: string[] })[]>(
    [],
  );
  const [homeStore, setHomeStore] = useState<Store | null>(null);

  const [storeId, setStoreId] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");
  const [date, setDate] = useState<string>(initialDate ?? "");

  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  // null = todavía no se sabe (sin verificar o la búsqueda falló): a nadie se le marca como nuevo.
  const [registeredTags, setRegisteredTags] = useState<Set<string> | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // TCG con calendario en la tienda del organizador (el servidor lo exige); null = sin filtro (admin, manager).
  const [storeGameIds, setStoreGameIds] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeLeagues, setActiveLeagues] = useState<{ id: string; name: string }[]>([]);
  const [countsForCircuit, setCountsForCircuit] = useState(true);
  const [leagueIds, setLeagueIds] = useState<string[]>([]);

  useEffect(() => {
    if (!player) return;
    (async () => {
      try {
        const { data: sess } = await nexus.auth.getSession();
        if (!sess.session) return;
        const ov = await fetchOverview();
        setGames(gamesOverride !== undefined ? gamesOverride : (ov.games as Game[]));
        setHomeStore((ov.homeStore as Store) ?? null);
        setStoreGameIds(isAdmin || isManager ? null : ov.homeStoreGameIds);
        if (isAdmin) {
          const s = await fetchStores();
          setStores(s.stores as Store[]);
        } else if (isManager) {
          const res: any = await fetchManagerStores();
          setManagerStores((res.stores ?? []) as (Store & { available_game_ids: string[] })[]);
        } else if (ov.homeStore) {
          setStoreId((ov.homeStore as Store).id);
        }
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const selectedGame = games.find((g) => g.id === gameId) ?? null;
  const colMap = selectedGame ? TCG_COLUMN_MAP[selectedGame.slug] : undefined;
  const tcgSupported = colMap && colMap.platform !== "unknown";
  const platformName =
    colMap?.platform === "bandai"
      ? "Bandai TCG+"
      : colMap?.platform === "magic"
        ? "Copy Paste Magic"
        : "Limitless";
  const storeGames = useMemo(
    () => (storeGameIds ? games.filter((g) => storeGameIds.includes(g.id)) : games),
    [games, storeGameIds],
  );

  // El TCG del torneo atrasado, o el único que se puede elegir: nada que volver a escribir.
  useEffect(() => {
    if (gameId) return;
    const options = storeGames.filter(isImportable);
    const pick =
      options.find((g) => g.id === initialGameId) ?? (options.length === 1 ? options[0] : null);
    if (pick) setGameId(pick.id);
  }, [storeGames, initialGameId, gameId]);

  const availableStoresForGame = useMemo(() => {
    if (!isManager) return stores;
    if (!gameId) return managerStores;
    return managerStores.filter((s) => s.available_game_ids.includes(gameId));
  }, [isManager, managerStores, stores, gameId]);

  useEffect(() => {
    if (!isManager) return;
    if (storeId && !availableStoresForGame.some((s) => s.id === storeId)) {
      setStoreId("");
    }
  }, [gameId, availableStoresForGame, isManager, storeId]);

  const selectedStore =
    stores.find((s) => s.id === storeId) ??
    managerStores.find((s) => s.id === storeId) ??
    (homeStore?.id === storeId ? homeStore : null);

  useEffect(() => {
    setCountsForCircuit(true);
    setLeagueIds([]);
    // Sin gameId todavía no sabemos qué ligas mostrar — una liga es de UN
    // TCG, así que el dropdown solo tiene sentido una vez elegido el juego.
    if (!storeId || !gameId || isManager) {
      setActiveLeagues([]);
      return;
    }
    (async () => {
      try {
        const res: any = await fetchActiveLeagues({ data: { store_id: storeId, game_id: gameId } });
        setActiveLeagues(res.leagues ?? []);
      } catch {
        setActiveLeagues([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, gameId, isManager]);

  const qualifying = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    const m = d.getMonth() + 1;
    return { month: m, semester: m <= 6 ? 1 : 2, year: d.getFullYear() };
  }, [date]);

  // Managers no ven ligas: siempre suben al circuito.
  const leagueInput = isManager
    ? { counts_for_circuit: true, league_ids: [] }
    : { counts_for_circuit: countsForCircuit, league_ids: leagueIds };
  const assigned = assignLeagues(leagueInput);
  const leagueError = "error" in assigned ? assigned.error : null;
  // Solo ligas: el servidor lo publica sin cola de aprobación (Épica 4), así que no es un borrador.
  const publishesDirect = !isManager && !countsForCircuit;
  const scopeLabel = [
    countsForCircuit && "Circuito Nacional",
    ...leagueIds.map((id) => activeLeagues.find((l) => l.id === id)?.name),
  ]
    .filter(Boolean)
    .join(" + ");
  // Fuera de la semana el servidor lo rechaza, pero hasta después de leer el archivo: se dice aquí.
  const { min: weekMin, max: weekMax } = getWeekDateRange();
  const dateError =
    date && !isAdmin && (date < weekMin || date > weekMax)
      ? `Elige una fecha entre el ${fmtShortDay(weekMin)} y el ${fmtShortDay(weekMax)}.`
      : null;
  const canContinue = Boolean(
    storeId && gameId && date && tcgSupported && !leagueError && !dateError,
  );
  // Por qué "Continuar" está deshabilitado: lo que falta por elegir (los demás bloqueos ya tienen su aviso).
  const missing = [
    (isAdmin || isManager) && !storeId && "tienda",
    !gameId && "TCG",
    !date && "fecha",
  ].filter(Boolean) as string[];
  const totalErrors = rows.filter((r) => r.error).length;
  const newPlayers = registeredTags
    ? rows.filter((r) => !r.error && !registeredTags.has(r.geek_tag)).length
    : 0;
  const winner = rows.find((r) => r.rank === 1);
  const canSubmit = rows.length > 0 && totalErrors === 0 && !saving;

  const clearFile = () => {
    setFileName(null);
    setSelectedFile(null);
    setRows([]);
    setRegisteredTags(null);
    setLookupFailed(false);
    setFileError(null);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Un problema del archivo se queda en pantalla (no es un toast) y deja elegir otro.
  const rejectFile = (message: string) => {
    clearFile();
    setFileError(message);
  };

  const verifyTags = async (list: ParsedRow[]) => {
    setRegisteredTags(null);
    setLookupFailed(false);
    try {
      const tags = Array.from(new Set(list.map((r) => r.geek_tag)));
      const res = await lookupTags({ data: { tags } });
      setRegisteredTags(new Set(res.existing));
    } catch {
      setLookupFailed(true);
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file || !colMap || colMap.platform === "unknown") return;
    setFileError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_TYPES.has(file.type)) {
      return rejectFile("Formato no válido. Solo se aceptan archivos .csv, .xls o .xlsx.");
    }
    if (file.size > MAX_FILE_SIZE) return rejectFile("El archivo no puede pesar más de 5 MB.");

    setFileName(file.name);
    setSelectedFile(file);
    setParsing(true);
    setRows([]);
    setRegisteredTags(null);
    setLookupFailed(false);
    try {
      const tableRows = await readFileToRows(file);
      const headers = (tableRows[0] ?? []).map((h) =>
        String(h ?? "")
          .trim()
          .toLowerCase(),
      );
      const missingCols = [colMap.nexusTag, colMap.rank, colMap.matchPoints].filter(
        (c) => c && !headers.includes(c.toLowerCase()),
      );
      if (missingCols.length) {
        return rejectFile(
          `Al archivo le faltan las columnas: ${missingCols.join(", ")}. Revisa que sea la exportación de ${platformName}.`,
        );
      }
      const parsed = normalizarPuntos(parseTable(tableRows, colMap));
      if (parsed.length === 0) {
        return rejectFile(
          `No encontramos jugadores en el archivo: la columna ${colMap.nexusTag} está vacía.`,
        );
      }
      setRows(parsed);
      await verifyTags(parsed);
    } catch (err) {
      rejectFile(String((err as Error).message ?? err));
    } finally {
      setParsing(false);
    }
  };

  const updateRow = <K extends keyof ParsedRow>(i: number, key: K, value: ParsedRow[K]) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const cleanRows = rows.map((r) => ({
        rank: r.rank,
        geek_tag: r.geek_tag.trim(),
        membership_id: r.membership_id,
        match_points: r.match_points,
        omw_percentage: r.omw_percentage,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        points_earned: r.points_earned,
      }));

      const tournamentId = randomId();
      const csvUrl = selectedFile ? await uploadFileToStorage(selectedFile, tournamentId) : null;

      const result = await submitUpload({
        data: {
          store_id: storeId,
          game_id: gameId,
          tournament_date: date,
          rows: cleanRows,
          tournament_id: tournamentId,
          csv_url: csvUrl,
          ...leagueInput,
        },
      });
      if (result && (result as { ok?: boolean }).ok === false) {
        toast.error((result as { message?: string }).message ?? "No se pudo subir el torneo.");
        return;
      }
      toast.success(
        publishesDirect
          ? "Torneo publicado."
          : "Torneo enviado correctamente. Un administrador lo revisará pronto.",
      );
      if ((result as { was_cancelled?: boolean }).was_cancelled) {
        toast.warning("Esta fecha estaba marcada como cancelada. Avisa a quien revise el torneo.");
      }
      // Publicado directo no queda en "Por revisar": se aterriza donde se ve.
      navigate({
        to: successTo,
        search:
          publishesDirect && successSearch?.tab === "pending"
            ? { ...successSearch, tab: "published" }
            : successSearch,
      });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (msg.toLowerCase().includes("ya existe")) toast.error(msg);
      else if (msg.toLowerCase().includes("fetch"))
        toast.error("Error al subir el torneo. Verifica tu conexión e intenta de nuevo.");
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitContent = (
    <>
      <Upload size={14} className="mr-1" aria-hidden />
      {saving
        ? publishesDirect
          ? "Publicando torneo..."
          : "Subiendo torneo..."
        : publishesDirect
          ? "Publicar torneo"
          : "Enviar para aprobación"}
    </>
  );

  if (roleLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isManager && !homeStore) {
    return (
      <div className={`${SURFACE} p-6 text-sm text-foreground-secondary`}>
        No tienes una tienda asignada. Contacta al administrador.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground">
          {step === 1 ? "Detalles del torneo" : "Resultados del torneo"}
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Paso {step} de 2
          {step === 1 &&
            (publishesDirect
              ? " · Se publica directo, sin revisión del administrador."
              : " · Se creará como Borrador hasta que un administrador lo apruebe.")}
        </p>
      </header>

      {step === 1 && (
        <section className={`${SURFACE} space-y-5 p-4 sm:p-6`}>
          <div className="space-y-2">
            {isAdmin || isManager ? (
              <>
                <Label htmlFor="upload-store" className={LABEL}>
                  Tienda
                </Label>
                <StoreCombobox
                  id="upload-store"
                  stores={isManager ? availableStoresForGame : stores}
                  value={storeId}
                  onChange={setStoreId}
                />
              </>
            ) : (
              <>
                <p className={LABEL}>Tienda</p>
                <p className="text-sm text-foreground">
                  {homeStore?.name} — {homeStore?.city ?? "—"}
                </p>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="upload-game" className={LABEL}>
                TCG
              </Label>
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger
                  id="upload-game"
                  className="min-h-11 border-border data-[placeholder]:text-foreground-subtle sm:min-h-9"
                >
                  <SelectValue placeholder="Selecciona un TCG" />
                </SelectTrigger>
                <SelectContent>
                  {storeGames.map((g) => (
                    <SelectItem
                      key={g.id}
                      value={g.id}
                      disabled={!isImportable(g)}
                      className="focus:bg-white/10 focus:text-foreground"
                    >
                      {g.name}
                      {!isImportable(g) && " — sin formato de importación"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {storeGames.length === 0 && (
                <p className="text-xs text-foreground-secondary">
                  {isManager
                    ? "No tienes ningún TCG asignado."
                    : "Tu tienda no tiene ningún TCG en su calendario de torneos."}{" "}
                  Contacta al administrador.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-date" className={LABEL}>
                Fecha del torneo
              </Label>
              {(() => {
                if (isAdmin) {
                  return (
                    <>
                      <Input
                        id="upload-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={DATE_INPUT}
                      />
                      <p className="mt-1 text-xs text-foreground-secondary">
                        Como administrador, puedes subir torneos de cualquier fecha.
                      </p>
                    </>
                  );
                }
                const { min, max } = getWeekDateRange();
                return (
                  <>
                    <Input
                      id="upload-date"
                      type="date"
                      min={min}
                      max={max}
                      value={date}
                      aria-invalid={dateError ? true : undefined}
                      onChange={(e) => setDate(e.target.value)}
                      className={DATE_INPUT}
                    />
                    <p className="mt-1 text-xs text-foreground-secondary">
                      Solo se permiten torneos de la semana actual ({fmtShortDay(min)} al{" "}
                      {fmtShortDay(max)}). ¿Es de otra semana? Contacta al administrador para
                      subirlo.
                    </p>
                    {dateError && (
                      <p role="alert" className="mt-1 text-xs text-destructive">
                        {dateError}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {qualifying && (
            <p className="text-xs text-foreground-secondary">
              Calificación: mes <strong className="text-foreground">{qualifying.month}</strong> ·
              semestre <strong className="text-foreground">{qualifying.semester}</strong> · año{" "}
              <strong className="text-foreground">{qualifying.year}</strong>
            </p>
          )}

          {!isManager && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground-secondary">
                Dónde cuenta este torneo
              </legend>
              <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={countsForCircuit}
                  onCheckedChange={(v) => setCountsForCircuit(v === true)}
                />
                Cuenta para el Circuito Nacional
              </label>
              {activeLeagues.map((l) => (
                <label
                  key={l.id}
                  className="flex min-h-11 items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={leagueIds.includes(l.id)}
                    onCheckedChange={(v) =>
                      setLeagueIds((prev) =>
                        v === true ? [...prev, l.id] : prev.filter((id) => id !== l.id),
                      )
                    }
                  />
                  {l.name}
                </label>
              ))}
              {leagueError ? (
                <p role="alert" className="text-xs text-destructive">
                  {leagueError}
                </p>
              ) : (
                <p className="text-xs text-foreground-secondary">
                  {!countsForCircuit
                    ? "Solo ligas: se publica directo."
                    : leagueIds.length
                      ? "Pasa por revisión; los puntos de liga aparecen cuando se publica."
                      : "Pasa por revisión antes de publicarse."}
                </p>
              )}
            </fieldset>
          )}

          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {missing.length > 0 && (
              <p
                id="continue-hint"
                className="w-full text-sm text-foreground-secondary sm:mr-auto sm:w-auto"
              >
                Falta: {missing.join(", ")}.
              </p>
            )}
            <button
              type="button"
              className={BTN_OUTLINE}
              onClick={() => navigate({ to: cancelTo })}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => setStep(2)}
              disabled={!canContinue}
              aria-describedby={missing.length > 0 ? "continue-hint" : undefined}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className={`${SURFACE} space-y-5 p-4 sm:p-6`}>
          <div className="mb-4 border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                <span>
                  <span className="text-foreground-secondary">Tienda: </span>
                  <span className="text-foreground font-semibold">{selectedStore?.name}</span>
                </span>
                <span className="hidden text-foreground-subtle sm:inline">·</span>
                <span>
                  <span className="text-foreground-secondary">TCG: </span>
                  <span className="text-foreground font-semibold">{selectedGame?.name}</span>
                </span>
                <span className="hidden text-foreground-subtle sm:inline">·</span>
                <span>
                  <span className="text-foreground-secondary">Fecha: </span>
                  <span className="text-foreground font-semibold">{fmtShortDay(date)}</span>
                </span>
                {!isManager && (
                  <>
                    <span className="hidden text-foreground-subtle sm:inline">·</span>
                    <span>
                      <span className="text-foreground-secondary">Cuenta para: </span>
                      <span className="text-foreground font-semibold">{scopeLabel}</span>
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`-ml-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded px-2 text-sm text-foreground-secondary transition hover:text-foreground sm:ml-0 sm:min-h-9 sm:self-auto ${FOCUS_RING}`}
              >
                <ArrowLeft size={12} aria-hidden />
                Editar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground-secondary">
              Archivo de resultados
            </Label>
            {fileError && (
              <InlineError onRetry={() => fileInputRef.current?.click()}>{fileError}</InlineError>
            )}
            {!fileName ? (
              <>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    handleFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50 ${
                    dragging
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/60 hover:bg-white/5"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                    <UploadCloud size={28} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Elige tu archivo, o arrástralo aquí
                  </p>
                  <p className="mt-1 text-xs text-foreground-secondary">
                    Exportado desde {platformName} · CSV, XLS o XLSX · máx. 5 MB
                  </p>
                </label>
                {colMap && colMap.platform !== "unknown" && (
                  <details className="text-sm text-foreground-secondary">
                    <summary className="min-h-11 cursor-pointer py-2.5 underline-offset-2 hover:underline">
                      ¿Qué columnas necesita el archivo?
                    </summary>
                    <p className="pb-2 text-xs text-foreground-secondary">
                      La primera fila debe tener estos encabezados, tal cual:{" "}
                      {[colMap.rank, colMap.nexusTag, colMap.matchPoints, colMap.omw, colMap.record]
                        .filter(Boolean)
                        .join(", ")}
                      .
                    </p>
                  </details>
                )}
              </>
            ) : (
              <div className="border-y border-border">
                <div className="flex items-start justify-between gap-3 border-b border-border p-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    {parsing ? (
                      <Loader2
                        size={16}
                        className="mt-0.5 flex-shrink-0 animate-spin text-primary"
                        aria-hidden
                      />
                    ) : (
                      <FileText
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-primary"
                        aria-hidden
                      />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span
                        className="max-w-[180px] truncate text-sm font-medium text-foreground sm:max-w-none"
                        title={fileName}
                      >
                        {fileName}
                      </span>
                      <span className="mt-0.5 text-xs text-foreground-secondary">
                        {parsing ? "Procesando…" : `${rows.length} participantes`}
                        {!parsing && newPlayers > 0 && (
                          <>
                            {" "}
                            · <span className="text-foreground">{newPlayers} nuevos</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    aria-label={`Quitar archivo ${fileName}`}
                    className={`flex min-h-11 flex-shrink-0 items-center gap-1 rounded border border-border px-3 text-xs text-foreground-secondary transition hover:border-destructive/40 hover:text-destructive sm:min-h-9 ${FOCUS_RING}`}
                  >
                    <X size={10} aria-hidden />
                    Quitar
                  </button>
                </div>

                {lookupFailed && (
                  <div className="border-b border-border px-4 py-3">
                    <InlineError onRetry={() => verifyTags(rows)}>
                      No pudimos verificar qué jugadores ya existen, así que ninguno se marca como
                      nuevo.
                    </InlineError>
                  </div>
                )}

                {!parsing && rows.length > 0 && (
                  <div className="max-h-[480px] overflow-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        Resultados del archivo: {rows.length} participantes
                      </caption>
                      <thead className="sticky top-0 bg-card text-xs text-foreground-subtle">
                        <tr>
                          <th scope="col" className="w-10 px-2 py-2 text-left font-medium sm:px-3">
                            #
                          </th>
                          <th scope="col" className="px-2 py-2 text-left font-medium sm:px-3">
                            Nexus Tag
                          </th>
                          <th
                            scope="col"
                            className="hidden px-3 py-2 text-left font-medium sm:table-cell"
                          >
                            Estado
                          </th>
                          <th
                            scope="col"
                            className="hidden px-3 py-2 text-right font-medium sm:table-cell"
                          >
                            Match Pts
                          </th>
                          <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">
                            Puntos
                          </th>
                          <th
                            scope="col"
                            className="hidden px-3 py-2 text-left font-medium sm:table-cell"
                          >
                            Membership ID
                          </th>
                          <th
                            scope="col"
                            className="hidden px-3 py-2 text-right font-medium sm:table-cell"
                          >
                            OMW%
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const isNew = registeredTags ? !registeredTags.has(r.geek_tag) : null;
                          const status = r.error ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/50 px-2 py-0.5 text-xs font-medium text-destructive">
                              {r.error}
                            </span>
                          ) : r.dropped ? (
                            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground-secondary">
                              Retirado
                            </span>
                          ) : isNew === null ? (
                            <span className="text-xs text-foreground-subtle">Sin verificar</span>
                          ) : isNew ? (
                            <span className="rounded-full border border-foreground-subtle px-2 py-0.5 text-xs font-medium text-foreground">
                              Nuevo
                            </span>
                          ) : (
                            <span className="text-xs text-foreground-secondary">Registrado</span>
                          );
                          return (
                            <tr
                              key={i}
                              className={`border-t border-border ${r.error ? "bg-destructive/10" : "hover:bg-white/5"}`}
                            >
                              <td className="px-2 py-2 font-mono text-xs text-primary sm:px-3">
                                {String(r.rank).padStart(2, "0")}
                              </td>
                              <td className="px-1 py-1 sm:px-2">
                                <input
                                  type="text"
                                  aria-label={`Nexus Tag, puesto ${r.rank}`}
                                  value={r.geek_tag}
                                  onChange={(e) => updateRow(i, "geek_tag", e.target.value)}
                                  className="min-h-11 w-full rounded bg-transparent px-2 py-1 font-medium text-foreground outline-none ring-inset focus:bg-white/10 focus:ring-1 focus:ring-primary sm:min-h-0"
                                />
                                <div className="px-2 pb-1 sm:hidden">{status}</div>
                              </td>
                              <td className="hidden px-3 py-2 sm:table-cell">{status}</td>
                              <td className="hidden px-3 py-2 text-right font-mono text-foreground sm:table-cell">
                                {r.match_points ?? "—"}
                              </td>
                              <td className="px-2 py-2 text-right font-mono font-semibold text-primary sm:px-3">
                                {Number(r.points_earned).toFixed(2)}
                              </td>
                              <td className="hidden px-3 py-2 font-mono text-xs text-foreground-secondary sm:table-cell">
                                {r.membership_id ?? "—"}
                              </td>
                              <td className="hidden px-3 py-2 text-right font-mono text-xs text-foreground-secondary sm:table-cell">
                                {r.omw_percentage != null ? `${r.omw_percentage}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="border-t border-border px-4 py-2 text-xs text-foreground-secondary">
                  Los Puntos se calculan como: (tus puntos / puntos del 1er lugar) × 100
                </p>
                {totalErrors > 0 && (
                  <p
                    role="alert"
                    className="border-t border-border px-4 py-2 text-xs text-destructive"
                  >
                    Hay {totalErrors} fila(s) con errores. Corrige el archivo antes de continuar.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={BTN_OUTLINE}
              onClick={() => setStep(1)}
              disabled={saving}
            >
              Atrás
            </button>
            {publishesDirect ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button type="button" className={BTN_PRIMARY} disabled={!canSubmit}>
                    {submitContent}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl border-border bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">
                      ¿Publicar este torneo?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-foreground-secondary">
                      Cuenta solo para {scopeLabel} y se publica ahora, sin revisión del
                      administrador.
                    </AlertDialogDescription>
                    <ul className="space-y-1 text-left text-sm text-foreground">
                      <li>
                        {selectedGame?.name} · {fmtShortDay(date)}
                      </li>
                      <li>
                        {rows.length} jugadores{registeredTags ? `, ${newPlayers} nuevos` : ""}
                      </li>
                      {winner && <li>Primer lugar: {winner.geek_tag}</li>}
                    </ul>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>Publicar torneo</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitContent}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function StoreCombobox({
  id,
  stores,
  value,
  onChange,
}: {
  id?: string;
  stores: Store[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = stores.find((s) => s.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={`${INPUT} flex items-center justify-between text-left transition hover:border-primary/40`}
        >
          <span className={selected ? "text-foreground" : "text-foreground-secondary"}>
            {selected
              ? `${selected.name} — ${selected.city ?? "—"}`
              : "Buscar y seleccionar tienda..."}
          </span>
          <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => {
            return val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nombre o ciudad..." />
          <CommandList>
            <CommandEmpty>No se encontraron tiendas.</CommandEmpty>
            <CommandGroup>
              {stores.map((s) => {
                const label = `${s.name} — ${s.city ?? "—"}`;
                return (
                  <CommandItem
                    key={s.id}
                    value={label}
                    className="data-[selected=true]:bg-white/10 data-[selected=true]:text-foreground"
                    onSelect={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      size={14}
                      className={`mr-2 ${value === s.id ? "opacity-100" : "opacity-0"}`}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
