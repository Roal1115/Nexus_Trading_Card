import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getOrganizerOverview,
  listActiveStores,
  lookupPlayerTags,
  uploadTournamentResults,
} from "@/lib/geekarena-organizer.functions";
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

export const Route = createFileRoute("/organizer/new")({
  component: NewTournamentPage,
});

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
};

const TCG_COLUMN_MAP: Record<string, ColumnMap> = {
  "one-piece": { platform: "bandai", rank: "Ranking", geekTag: "User Name", matchPoints: "Win Points", omw: "OMW %" },
  "dragon-ball": { platform: "bandai", rank: "Ranking", geekTag: "User Name", matchPoints: "Win Points", omw: "OMW %" },
  gundam: { platform: "bandai", rank: "Ranking", geekTag: "User Name", matchPoints: "Win Points", omw: "OMW %" },
  riftbound: {
    platform: "limitless",
    rank: "Rank",
    geekTag: "Display Name",
    matchPoints: "Match Points",
    omw: "Opponent Match Win %",
    record: "Record (W-L-D)",
    status: "Registration Status",
  },
  pokemon: { platform: "unknown" },
  "magic-the-gathering": { platform: "unknown" },
};

function calcularPuntosArena(rank: number): number {
  if (rank === 1) return 100;
  if (rank === 2) return 85;
  if (rank === 3 || rank === 4) return 70;
  if (rank >= 5 && rank <= 8) return 50;
  if (rank >= 9 && rank <= 16) return 30;
  if (rank >= 17 && rank <= 32) return 15;
  return 5;
}

type ParsedRow = {
  rank: number;
  geek_tag: string;
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

function parseCSV(text: string, map: ColumnMap): ParsedRow[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const idx = (key: string | undefined) =>
    key ? headers.findIndex((h) => h.toLowerCase() === key.toLowerCase()) : -1;

  const iRank = idx(map.rank);
  const iTag = idx(map.geekTag);
  const iPts = idx(map.matchPoints);
  const iOmw = idx(map.omw);
  const iRec = idx(map.record);
  const iSt = idx(map.status);

  const rows: ParsedRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]);
    const tag = (iTag !== -1 ? cols[iTag] : "").trim();
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

    rows.push({
      rank: isFinite(rank) ? rank : 0,
      geek_tag: tag,
      match_points: isFinite(mp) ? mp : null,
      omw_percentage: parsePct(iOmw !== -1 ? cols[iOmw] : undefined, map.platform),
      wins,
      losses,
      draws,
      points_earned: isFinite(rank) && rank >= 1 ? calcularPuntosArena(rank) : 0,
      dropped,
      error,
    });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

function NewTournamentPage() {
  const navigate = useNavigate();
  const { player, loading: roleLoading } = useGeekarenaRole();
  const isAdmin = player?.role === "admin";

  const fetchOverview = useServerFn(getOrganizerOverview);
  const fetchStores = useServerFn(listActiveStores);
  const submitUpload = useServerFn(uploadTournamentResults);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [games, setGames] = useState<Game[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [homeStore, setHomeStore] = useState<Store | null>(null);

  const [storeId, setStoreId] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");
  const [date, setDate] = useState<string>("");

  const [fileName, setFileName] = useState<string | null>(null);
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
        const ov = await fetchOverview();
        setGames(ov.games as Game[]);
        setHomeStore((ov.homeStore as Store) ?? null);
        if (isAdmin) {
          const s = await fetchStores();
          setStores(s.stores as Store[]);
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

  const selectedStore =
    stores.find((s) => s.id === storeId) ?? (homeStore?.id === storeId ? homeStore : null);

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

  const handleFile = (file: File | null) => {
    if (!file || !colMap || colMap.platform === "unknown") return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Solo se aceptan archivos .csv");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setRows([]);
    setRegisteredTags(new Set());
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = parseCSV(e.target?.result as string, colMap);
        if (parsed.length === 0) {
          toast.error(
            "No se encontraron filas válidas. Verifica las columnas requeridas.",
          );
          setParsing(false);
          return;
        }
        setRows(parsed);
        // Verify which players exist
        toast.message("Verificando jugadores en el sistema...");
        const tags = Array.from(new Set(parsed.map((r) => r.geek_tag)));
        const { data, error } = await geekarena
          .from("players")
          .select("geek_tag")
          .in("geek_tag", tags);
        if (error) {
          toast.error("Error al verificar jugadores: " + error.message);
        } else {
          setRegisteredTags(
            new Set((data ?? []).map((p: { geek_tag: string }) => p.geek_tag)),
          );
        }
      } catch (err) {
        toast.error(String((err as Error).message ?? err));
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      toast.error("Error al leer el archivo.");
      setParsing(false);
    };
    toast.message("Analizando archivo...");
    reader.readAsText(file);
  };

  const clearFile = () => {
    setFileName(null);
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
        match_points: r.match_points,
        omw_percentage: r.omw_percentage,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        points_earned: r.points_earned,
      }));
      await submitUpload({
        data: {
          store_id: storeId,
          game_id: gameId,
          tournament_date: date,
          rows: cleanRows,
        },
      });
      toast.success("Torneo enviado correctamente. Un administrador lo revisará pronto.");
      navigate({ to: "/organizer/tournaments" });
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

  if (!isAdmin && !homeStore) {
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
              {isAdmin ? "Seleccionar tienda *" : "Tienda"}
            </Label>
            {isAdmin ? (
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una tienda" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.city ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                {homeStore?.name} — {homeStore?.city ?? "—"}
              </div>
            )}
            {isAdmin && !storeId && (
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
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
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
              onClick={() => navigate({ to: "/organizer/tournaments" })}
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
            <div>
              Tienda: <span className="text-white">{selectedStore?.name}</span> ·{" "}
              TCG: <span className="text-white">{selectedGame?.name}</span> ·{" "}
              Fecha: <span className="text-white">{date}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              disabled={saving}
            >
              <ArrowLeft size={14} className="mr-1" /> Editar
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
              <UploadCloud size={13} className="text-primary" /> Resultados (CSV)
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
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                  <UploadCloud size={28} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-white">
                  Arrastra tu CSV aquí, o haz clic para buscar
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Formato detectado: {colMap?.platform === "bandai" ? "Bandai TCG+" : "Limitless"}
                </p>
              </label>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    {parsing ? (
                      <Loader2 size={16} className="animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 size={16} className="text-primary" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <FileSpreadsheet size={13} className="text-gray-400" />
                        {fileName}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-gray-500">
                        {parsing
                          ? "Procesando…"
                          : `${rows.length} participantes · ${newPlayers} nuevos jugadores serán creados automáticamente`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-gray-400 transition hover:border-red-500/40 hover:text-red-400"
                  >
                    <X size={11} /> Quitar
                  </button>
                </div>

                {!parsing && rows.length > 0 && (
                  <div className="max-h-[480px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-black/60 text-xs uppercase tracking-wider text-gray-500 backdrop-blur">
                        <tr>
                          <th className="w-10 px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Geek Tag</th>
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
                              <td className="px-3 py-2 text-right font-mono text-white">
                                {r.match_points ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                                {r.omw_percentage != null ? `${r.omw_percentage}%` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-primary">
                                {r.points_earned}
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
