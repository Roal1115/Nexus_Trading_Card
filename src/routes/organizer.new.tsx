import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getOrganizerOverview,
  createTournament,
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

type Game = { id: string; name: string };

interface ParsedRow {
  geekTag: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const col = (keys: string[]) => {
    for (const k of keys) {
      const i = headers.indexOf(k);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iTag = col(["geek tag", "geektag", "tag", "jugador", "player"]);
  const iPts = col(["points", "puntos", "pts"]);
  const iW = col(["wins", "victorias", "w"]);
  const iL = col(["losses", "derrotas", "l"]);
  const iD = col(["draws", "empates", "d"]);
  return lines
    .slice(1)
    .map((line) => {
      const c = line.split(",").map((x) => x.trim());
      return {
        geekTag: iTag !== -1 ? c[iTag] : c[0] ?? "",
        points: Number(iPts !== -1 ? c[iPts] : c[1]) || 0,
        wins: Number(iW !== -1 ? c[iW] : c[2]) || 0,
        losses: Number(iL !== -1 ? c[iL] : c[3]) || 0,
        draws: Number(iD !== -1 ? c[iD] : c[4]) || 0,
      };
    })
    .filter((r) => r.geekTag.length > 0);
}

function NewTournamentPage() {
  const navigate = useNavigate();
  const { player, loading: roleLoading } = useGeekarenaRole();
  const email = player?.email ?? null;

  const fetchOverview = useServerFn(getOrganizerOverview);
  const submit = useServerFn(createTournament);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [hasStore, setHasStore] = useState(false);

  const [gameId, setGameId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res = await fetchOverview();
        setGames(res.games as Game[]);
        setHasStore(Boolean(res.homeStore));
        setStoreName(res.homeStore?.name ?? null);
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const qualifying = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    const m = d.getMonth() + 1;
    return {
      month: m,
      semester: m <= 6 ? 1 : 2,
      year: d.getFullYear(),
    };
  }, [date]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Solo se aceptan archivos .csv");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target?.result as string);
      if (parsed.length === 0) toast.error("No se encontraron filas válidas.");
      setRows(parsed);
      setParsing(false);
    };
    reader.onerror = () => {
      toast.error("Error al leer el archivo.");
      setParsing(false);
    };
    reader.readAsText(file);
  };
  const clearFile = () => {
    setFileName(null);
    setRows([]);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!email) return;
    if (!gameId) return toast.error("Selecciona un juego (TCG)");
    if (!date) return toast.error("Selecciona una fecha");

    setSaving(true);
    try {
      await submit({
        data: {
          game_id: gameId,
          tournament_date: date,
          csv_url: null,
        },
      });
      toast.success("Torneo creado como borrador");
      navigate({ to: "/organizer/tournaments" });
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
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

  if (!hasStore) {
    return (
      <div className="glass rounded-2xl p-8 text-sm text-gray-300">
        Primero debes asignar una tienda en{" "}
        <a href="/organizer" className="text-primary underline">
          Mi Tienda
        </a>
        .
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Subir Torneo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Registrar nuevo torneo
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Tienda: <span className="text-white">{storeName}</span> · Se creará
          como Borrador hasta que un administrador lo apruebe.
        </p>
      </header>

      <section className="glass space-y-5 rounded-2xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">TCG (juego)</Label>
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
            <Label className="text-xs text-gray-400">Fecha del torneo</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
            <UploadCloud size={13} className="text-primary" /> Resultados del torneo (CSV)
          </Label>
          {!fileName ? (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${dragging ? "border-primary bg-primary/10" : "border-white/20 bg-white/[0.03] hover:border-primary/60 hover:bg-white/[0.05]"}`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                <UploadCloud size={28} className="text-primary" />
              </div>
              <p className="text-sm font-semibold text-white">Arrastra tu CSV aquí, o haz clic para buscar</p>
              <p className="mt-1 text-xs text-gray-500">Formato: .csv · Columnas: Geek Tag, Points, Wins, Losses, Draws</p>
            </label>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  {parsing ? <Loader2 size={16} className="animate-spin text-primary" /> : <CheckCircle2 size={16} className="text-primary" />}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white"><FileSpreadsheet size={13} className="text-gray-400" />{fileName}</div>
                    <div className="text-[11px] uppercase tracking-wider text-gray-500">{parsing ? "Leyendo archivo…" : `${rows.length} jugadores cargados`}</div>
                  </div>
                </div>
                <button type="button" onClick={clearFile} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-gray-400 transition hover:border-red-500/40 hover:text-red-400">
                  <X size={11} /> Quitar
                </button>
              </div>
              {parsing ? (
                <div className="flex flex-col items-center justify-center py-10"><Loader2 size={22} className="animate-spin text-primary" /><p className="mt-3 text-xs uppercase tracking-widest text-gray-500">Procesando…</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/40 text-xs uppercase tracking-wider text-gray-500">
                      <tr><th className="w-10 px-4 py-2 text-left">#</th><th className="px-4 py-2 text-left">Geek Tag</th><th className="px-4 py-2 text-right">Pts</th><th className="px-4 py-2 text-right">V</th><th className="px-4 py-2 text-right">D</th><th className="px-4 py-2 text-right">E</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2.5 font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</td>
                          <td className="px-4 py-2.5 font-medium text-white">{row.geekTag}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-white">{row.points}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-400">{row.wins}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-400">{row.losses}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-400">{row.draws}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {qualifying && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
            Calificación calculada: mes <strong className="text-white">{qualifying.month}</strong>{" "}
            · semestre{" "}
            <strong className="text-white">{qualifying.semester}</strong> ·
            año <strong className="text-white">{qualifying.year}</strong>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/organizer/tournaments" })}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            <Upload size={14} className="mr-1" />
            {saving ? "Guardando..." : "Crear borrador"}
          </Button>
        </div>
      </section>
    </div>
  );
}
