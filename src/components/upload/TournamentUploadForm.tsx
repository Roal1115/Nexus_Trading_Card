import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  AlertCircle,
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
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { geekarena } from "@/integrations/geekarena/client";
import {
  getOrganizerOverview,
  listActiveStores,
  lookupPlayerTags,
  uploadTournamentResults,
} from "@/lib/geekarena-organizer.functions";
import { getManagerResponsibleStores } from "@/lib/geekarena-manager.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Game = { id: string; slug: string; name: string };
type Store = { id: string; name: string; city: string | null };

type Platform = "bandai" | "limitless" | "unknown";
type ColumnMap = {
  platform: Platform;
  rank?: string;
  geekTag?: string;
  matchPoints?: string;
  omw?: string;
  record?: string;
  status?: string;
  membershipId?: string;
};

const TCG_COLUMN_MAP: Record<string, ColumnMap> = {
  "one-piece": { platform: "bandai", rank: "Ranking", geekTag: "User Name", matchPoints: "Win Points", omw: "OMW %", membershipId: "Membership Number" },
  "dragon-ball": { platform: "bandai", rank: "Ranking", geekTag: "User Name", matchPoints: "Win Points", omw: "OMW %", membershipId: "Membership Number" },
  gundam: { platform: "bandai", rank: "Ranking", geekTag: "User Name", matchPoints: "Win Points", omw: "OMW %", membershipId: "Membership Number" },
  riftbound: {
    platform: "limitless",
    rank: "Rank",
    geekTag: "Display Name",
    matchPoints: "Match Points",
    omw: "Opponent Match Win %",
    record: "Record (W-L-D)",
    status: "Registration Status",
    membershipId: "User ID",
  },
  pokemon: { platform: "unknown" },
  "magic-the-gathering": { platform: "unknown" },
};

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
  const iTag = idx(map.geekTag);
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
    } else if (map.platform === "bandai") {
      draws = 0;
    }

    const rank = iRank !== -1 ? Number(cols[iRank]) : NaN;
    const mp = iPts !== -1 ? Number(cols[iPts]) : NaN;
    const dropped =
      iSt !== -1 && (cols[iSt] || "").toUpperCase() === "DROPPED";

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
  const buf = await file.arrayBuffer();

  const extractRows = (sheet: any): string[][] => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row: any) => {
      const values = (row.values as any[]).slice(1);
      rows.push(
        values.map((v: any) => {
          if (v == null) return "";
          if (typeof v === "object" && v.result != null) return String(v.result);
          if (typeof v === "object" && v.text != null) return String(v.text);
          if (typeof v === "object" && v.richText) {
            return v.richText.map((rt: any) => rt.text).join("");
          }
          return String(v);
        })
      );
    });
    return rows;
  };

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error("No se encontró ninguna hoja en el archivo.");
    const rows = extractRows(sheet);
    if (rows.length === 0) throw new Error("El archivo no contiene filas con datos.");
    return rows;
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (!/cannot include any of the following characters/i.test(msg)) {
      console.error("Error parsing XLSX:", err);
      throw new Error(
        `No se pudo leer el archivo Excel: ${msg || "formato no soportado"}. Intenta exportarlo de nuevo o usar formato CSV.`,
      );
    }

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buf);

      const workbookXmlFile = zip.file("xl/workbook.xml");
      if (!workbookXmlFile) throw new Error("Estructura de archivo inválida.");
      let workbookXml = await workbookXmlFile.async("string");

      workbookXml = workbookXml.replace(
        /(<sheet[^>]*\sname=")([^"]*)(")/g,
        (_m, pre, name, post) => pre + name.replace(/[\*\?:\\\/\[\]]/g, "_") + post,
      );
      zip.file("xl/workbook.xml", workbookXml);

      const patchedBuf = await zip.generateAsync({ type: "arraybuffer" });
      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.load(patchedBuf);
      const sheet2 = wb2.worksheets[0];
      if (!sheet2) throw new Error("No se encontró ninguna hoja en el archivo.");
      const rows = extractRows(sheet2);
      if (rows.length === 0) throw new Error("El archivo no contiene filas con datos.");
      return rows;
    } catch (err2) {
      console.error("Error parsing XLSX (fallback):", err2);
      throw new Error(
        "No se pudo leer el archivo Excel debido al nombre de la hoja (contiene caracteres especiales como [ ]). Renombra la hoja en Excel o usa formato CSV.",
      );
    }
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

async function uploadFileToStorage(
  file: File,
  tournamentId: string,
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";
    const path = `tournaments/${tournamentId}.${ext}`;
    const { error } = await geekarena.storage
      .from("tournament-files")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) {
      console.error("Storage upload error:", error.message);
      return null;
    }
    const { data } = await geekarena.storage
      .from("tournament-files")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? null;
  } catch (e) {
    console.error("Storage error:", e);
    return null;
  }
}

function getWeekDateRange(): { min: string; max: string } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun ... 6=Sab
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { min: fmt(monday), max: fmt(today) };
}

export function TournamentUploadForm({
  cancelTo = "/organizer/tournaments",
  successTo = "/organizer/tournaments",
  gamesOverride,
}: {
  cancelTo?: string;
  successTo?: string;
  gamesOverride?: Game[];
} = {}) {
  const navigate = useNavigate();
  const { player, loading: roleLoading } = useGeekarenaRole();
  const isAdmin = player?.role === "admin";
  const isManager = player?.role === "tcg_manager";

  const fetchOverview = useServerFn(getOrganizerOverview);
  const fetchStores = useServerFn(listActiveStores);
  const fetchManagerStores = useServerFn(getManagerResponsibleStores);
  const submitUpload = useServerFn(uploadTournamentResults);
  const lookupTags = useServerFn(lookupPlayerTags);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [games, setGames] = useState<Game[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [managerStores, setManagerStores] = useState<(Store & { available_game_ids: string[] })[]>([]);
  const [homeStore, setHomeStore] = useState<Store | null>(null);

  const [storeId, setStoreId] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");
  const [date, setDate] = useState<string>("");

  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [registeredTags, setRegisteredTags] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!player) return;
    (async () => {
      try {
        const { data: sess } = await geekarena.auth.getSession();
        if (!sess.session) return;
        const ov = await fetchOverview();
        setGames(gamesOverride !== undefined ? gamesOverride : (ov.games as Game[]));
        setHomeStore((ov.homeStore as Store) ?? null);
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

  const qualifying = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    const m = d.getMonth() + 1;
    return { month: m, semester: m <= 6 ? 1 : 2, year: d.getFullYear() };
  }, [date]);

  const canContinue = Boolean(storeId && gameId && date && tcgSupported);
  const totalErrors = rows.filter((r) => r.error).length;
  const newPlayers = rows.filter(
    (r) => !r.error && !registeredTags.has(r.geek_tag),
  ).length;
  const canSubmit = rows.length > 0 && totalErrors === 0 && !saving;

  const handleFile = async (file: File | null) => {
    if (!file || !colMap || colMap.platform === "unknown") return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_TYPES.has(file.type)) {
      toast.error("Formato no válido. Solo se aceptan archivos .csv, .xls o .xlsx");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo no puede pesar más de 5 MB");
      return;
    }

    setFileName(file.name);
    setSelectedFile(file);
    setParsing(true);
    setRows([]);
    setRegisteredTags(new Set());
    toast.message("Analizando archivo...");
    try {
      const tableRows = await readFileToRows(file);
      const rawParsed = parseTable(tableRows, colMap);
      const parsed = normalizarPuntos(rawParsed);
      if (parsed.length === 0) {
        toast.error(
          "No se encontraron filas válidas. Verifica las columnas requeridas.",
        );
        setParsing(false);
        return;
      }
      setRows(parsed);
      toast.message("Verificando jugadores en el sistema...");
      const tags = Array.from(new Set(parsed.map((r) => r.geek_tag)));
      try {
        const res = await lookupTags({ data: { tags } });
        setRegisteredTags(new Set(res.existing));
      } catch (err) {
        toast.error(
          "Error al verificar jugadores: " +
            String((err as Error).message ?? err),
        );
      }
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setParsing(false);
    }
  };

  const clearFile = () => {
    setFileName(null);
    setSelectedFile(null);
    setRows([]);
    setRegisteredTags(new Set());
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateRow = <K extends keyof ParsedRow>(i: number, key: K, value: ParsedRow[K]) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)),
    );
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

      const tournamentId = crypto.randomUUID();
      const csvUrl = selectedFile
        ? await uploadFileToStorage(selectedFile, tournamentId)
        : null;

      const result = await submitUpload({
        data: {
          store_id: storeId,
          game_id: gameId,
          tournament_date: date,
          rows: cleanRows,
          tournament_id: tournamentId,
          csv_url: csvUrl,
        },
      });
      if (result && (result as { ok?: boolean }).ok === false) {
        toast.error(
          (result as { message?: string }).message ??
            "No se pudo subir el torneo.",
        );
        return;
      }
      toast.success("Torneo enviado correctamente. Un administrador lo revisará pronto.");
      navigate({ to: successTo });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (msg.toLowerCase().includes("ya existe")) toast.error(msg);
      else if (msg.toLowerCase().includes("fetch")) toast.error("Error al subir el torneo. Verifica tu conexión e intenta de nuevo.");
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isManager && !homeStore) {
    return (
      <div className="glass rounded-2xl p-8 text-sm text-gray-300">
        No tienes una tienda asignada. Contacta al administrador.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Subir Torneo · Paso {step} de 2
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {step === 1 ? "Detalles del torneo" : "Resultados del torneo"}
        </h1>
        {step === 1 && (
          <p className="mt-1 text-sm text-gray-400">
            Se creará como Borrador hasta que un administrador lo apruebe.
          </p>
        )}
      </header>

      {step === 1 && (
        <section className="glass space-y-5 rounded-2xl p-6">
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">
              {isAdmin || isManager ? "Seleccionar tienda *" : "Tienda"}
            </Label>
            {isAdmin || isManager ? (
              <StoreCombobox
                stores={isManager ? availableStoresForGame : stores}
                value={storeId}
                onChange={setStoreId}
              />
            ) : (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                Tienda: {homeStore?.name} — {homeStore?.city ?? "—"}
              </div>
            )}
            {(isAdmin || isManager) && !storeId && (
              <p className="text-xs text-amber-400">
                Debes seleccionar una tienda para continuar
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">TCG (juego) *</Label>
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un TCG" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Fecha del torneo *</Label>
              {(() => {
                const { min, max } = getWeekDateRange();
                return (
                  <>
                    <Input
                      type="date"
                      min={min}
                      max={max}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Solo se permiten torneos de la semana actual ({min} al {max}).
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          {selectedGame && !tcgSupported && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              Este TCG aún no tiene un formato de importación configurado. Contacta al administrador.
            </div>
          )}

          {qualifying && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
              Calificación: mes <strong className="text-white">{qualifying.month}</strong> · semestre{" "}
              <strong className="text-white">{qualifying.semester}</strong> · año{" "}
              <strong className="text-white">{qualifying.year}</strong>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate({ to: cancelTo })}
            >
              Cancelar
            </Button>
            <Button onClick={() => setStep(2)} disabled={!canContinue}>
              Continuar
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="glass space-y-5 rounded-2xl p-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                <span>
                  <span className="text-gray-500">Tienda: </span>
                  <span className="text-white font-semibold">{selectedStore?.name}</span>
                </span>
                <span className="hidden sm:inline text-gray-600">·</span>
                <span>
                  <span className="text-gray-500">TCG: </span>
                  <span className="text-white font-semibold">{selectedGame?.name}</span>
                </span>
                <span className="hidden sm:inline text-gray-600">·</span>
                <span>
                  <span className="text-gray-500">Fecha: </span>
                  <span className="text-white font-semibold">{date}</span>
                </span>
              </div>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition self-start sm:self-auto"
              >
                <ArrowLeft size={12} />
                Editar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
              <UploadCloud size={13} className="text-primary" /> Resultados (CSV, XLS o XLSX)
            </Label>
            {!fileName ? (
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                  dragging
                    ? "border-primary bg-primary/10"
                    : "border-white/20 bg-white/[0.03] hover:border-primary/60 hover:bg-white/[0.05]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                  <UploadCloud size={28} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-white">
                  Arrastra tu archivo aquí, o haz clic para buscar
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Formato detectado: {colMap?.platform === "bandai" ? "Bandai TCG+" : "Limitless"}
                </p>
              </label>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {parsing ? (
                      <Loader2 size={16} className="animate-spin text-primary flex-shrink-0 mt-0.5" />
                    ) : (
                      <FileText size={16} className="text-primary flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-sm text-white font-medium truncate max-w-[180px] sm:max-w-none"
                        title={fileName}
                      >
                        {fileName}
                      </span>
                      <span className="text-xs text-gray-400 mt-0.5">
                        {parsing
                          ? "Procesando…"
                          : `${rows.length} participantes`}
                        {!parsing && newPlayers > 0 && (
                          <> · <span className="text-orange-400">{newPlayers} nuevos</span></>
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-400/40 rounded px-2 py-1 transition"
                  >
                    <X size={10} />
                    Quitar
                  </button>
                </div>

                {!parsing && rows.length > 0 && (
                  <div className="max-h-[480px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-black/60 text-xs uppercase tracking-wider text-gray-500 backdrop-blur">
                        <tr>
                          <th className="w-10 px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Geek Tag</th>
                          <th className="px-3 py-2 text-left">Membership ID</th>
                          <th className="px-3 py-2 text-right">Match Pts</th>
                          <th className="px-3 py-2 text-right">OMW%</th>
                          <th className="px-3 py-2 text-right">Pts Arena</th>
                          <th className="px-3 py-2 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const isNew = !registeredTags.has(r.geek_tag);
                          return (
                            <tr
                              key={i}
                              className={`border-t border-white/5 ${r.error ? "bg-red-500/10" : "hover:bg-white/5"}`}
                            >
                              <td className="px-3 py-2 font-mono text-xs text-primary">
                                {String(r.rank).padStart(2, "0")}
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  value={r.geek_tag}
                                  onChange={(e) => updateRow(i, "geek_tag", e.target.value)}
                                  className="w-full rounded bg-transparent px-2 py-1 font-medium text-white outline-none ring-inset focus:bg-white/10 focus:ring-1 focus:ring-primary"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">
                                {r.membership_id ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-white">
                                {r.match_points ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                                {r.omw_percentage != null ? `${r.omw_percentage}%` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-primary">
                                {Number(r.points_earned).toFixed(2)}
                              </td>
                              <td className="px-3 py-2">
                                {r.error ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                                    {r.error}
                                  </span>
                                ) : r.dropped ? (
                                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                    Retirado
                                  </span>
                                ) : isNew ? (
                                  <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                                    Nuevo
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                                    Registrado
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="border-t border-white/5 px-4 py-2 text-[11px] text-gray-400">
                  Los Puntos Arena se calculan como: (tus puntos / puntos del 1er lugar) × 100
                </p>
                {totalErrors > 0 && (
                  <p className="border-t border-white/5 px-4 py-2 text-xs text-red-300">
                    Hay {totalErrors} fila(s) con errores. Corrige el CSV antes de continuar.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
              Atrás
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              <Upload size={14} className="mr-1" />
              {saving ? "Subiendo torneo..." : "Enviar para aprobación"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function StoreCombobox({
  stores,
  value,
  onChange,
}: {
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
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-primary/40"
        >
          <span className={selected ? "text-white" : "text-gray-400"}>
            {selected
              ? `${selected.name} — ${selected.city ?? "—"}`
              : "Buscar y seleccionar tienda..."}
          </span>
          <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
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

