import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Send, UploadCloud, X } from "lucide-react";
import { useStore, type TCG } from "@/lib/mock-store";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Upload Results — Geek Collector" }] }),
  component: UploadPage,
});

const TCGS: TCG[] = ["One Piece", "Magic: The Gathering", "Pokémon"];

interface ParsedRow {
  geekTag: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

const MOCK_POOL: ParsedRow[] = [
  { geekTag: "VoidStriker",   points: 320, wins: 7, losses: 1, draws: 0 },
  { geekTag: "NeonShogun",    points: 280, wins: 6, losses: 1, draws: 1 },
  { geekTag: "ArcaneFlux",    points: 240, wins: 6, losses: 2, draws: 0 },
  { geekTag: "PhantomDeck",   points: 210, wins: 5, losses: 2, draws: 1 },
  { geekTag: "CrimsonOath",   points: 180, wins: 5, losses: 3, draws: 0 },
  { geekTag: "HexProof",      points: 160, wins: 4, losses: 3, draws: 1 },
  { geekTag: "EmberFox",      points: 140, wins: 4, losses: 4, draws: 0 },
  { geekTag: "RuneSmith",     points: 120, wins: 3, losses: 4, draws: 1 },
  { geekTag: "PixelBaron",    points: 100, wins: 3, losses: 5, draws: 0 },
  { geekTag: "GhostType",      points: 80,  wins: 2, losses: 5, draws: 1 },
];

function UploadPage() {
  const { currentUser, submitTournament } = useStore();
  const navigate = useNavigate();
  const [tcg, setTcg] = useState<TCG>("One Piece");
  const [city, setCity] = useState("");
  const [store, setStore] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Organizers only</h2>
        <p className="mt-2 text-sm text-gray-400">Sign in as a Tournament Organizer to submit results.</p>
        <Link to="/login" className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground">Sign in</Link>
      </main>
    );
  }

  const handleFile = (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setRows([]);
    // Simulated parse — pick 5-10 rows from mock pool
    const count = 5 + Math.floor(Math.random() * 6);
    setTimeout(() => {
      setRows(MOCK_POOL.slice(0, count));
      setParsing(false);
    }, 1100);
  };

  const clearFile = () => {
    setFileName(null);
    setRows([]);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) return;
    submitTournament({
      tcg, city, store, date,
      results: rows.map((r) => ({ geekTag: r.geekTag, points: r.points })),
    });
    setSubmitted(true);
    setTimeout(() => navigate({ to: "/" }), 1600);
  };

  const canSubmit = rows.length > 0 && !parsing && city && store && !submitted;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      <header className="my-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tournament Organizer Portal</p>
        <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl">Submit Results</h1>
        <p className="mt-2 text-sm text-gray-400">All submissions enter the moderation queue for admin approval before they impact the National Circuit.</p>
      </header>

      <form onSubmit={submit} className="glass rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="TCG">
            <select value={tcg} onChange={(e) => setTcg(e.target.value as TCG)} className="upload-input">
              {TCGS.map((t) => <option key={t} className="bg-black">{t}</option>)}
            </select>
          </FieldLabel>
          <FieldLabel label="Date">
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="upload-input" />
          </FieldLabel>
          <FieldLabel label="City">
            <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" className="upload-input" />
          </FieldLabel>
          <FieldLabel label="Store Name">
            <input required value={store} onChange={(e) => setStore(e.target.value)} placeholder="Dragon's Hoard" className="upload-input" />
          </FieldLabel>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-400">
            <UploadCloud size={14} className="text-primary" /> Tournament Results CSV
          </h2>

          {!fileName ? (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
                dragging
                  ? "border-primary bg-primary/10"
                  : "border-white/20 bg-[#262626] hover:border-primary/60 hover:bg-[#2d2d2d]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                <UploadCloud size={32} className="text-primary" />
              </div>
              <p className="text-base font-semibold text-white">
                Drag &amp; drop your tournament CSV file here, or click to browse.
              </p>
              <p className="mt-1.5 text-xs text-gray-500">
                Accepted format: .csv · Columns: Geek Tag, Points, Wins, Losses, Draws
              </p>
            </label>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#262626]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <div className="flex items-center gap-3">
                  {parsing ? (
                    <Loader2 size={18} className="animate-spin text-primary" />
                  ) : (
                    <CheckCircle2 size={18} className="text-primary" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <FileSpreadsheet size={14} className="text-gray-400" />
                      {fileName}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-gray-500">
                      {parsing ? "Parsing CSV…" : `${rows.length} player results loaded`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-gray-400 transition hover:border-destructive/40 hover:text-destructive"
                >
                  <X size={12} /> Remove
                </button>
              </div>

              {parsing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <p className="mt-3 text-xs uppercase tracking-widest text-gray-500">Reading file…</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/40 text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left w-12">#</th>
                        <th className="px-4 py-2 text-left">Geek Tag</th>
                        <th className="px-4 py-2 text-right">Points</th>
                        <th className="px-4 py-2 text-right">W</th>
                        <th className="px-4 py-2 text-right">L</th>
                        <th className="px-4 py-2 text-right">D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2.5 font-mono-stat text-xs text-primary">{String(i + 1).padStart(2, "0")}</td>
                          <td className="px-4 py-2.5 font-medium text-white">{row.geekTag}</td>
                          <td className="px-4 py-2.5 text-right font-mono-stat font-semibold text-white">{row.points}</td>
                          <td className="px-4 py-2.5 text-right font-mono-stat text-xs text-gray-400">{row.wins}</td>
                          <td className="px-4 py-2.5 text-right font-mono-stat text-xs text-gray-400">{row.losses}</td>
                          <td className="px-4 py-2.5 text-right font-mono-stat text-xs text-gray-400">{row.draws}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-gray-500"
        >
          <Send size={16} />
          {submitted
            ? "Submitted — Awaiting Approval"
            : rows.length === 0
              ? "Upload a CSV to Continue"
              : "Submit for Admin Approval"}
        </button>
      </form>

      <style>{`
        .upload-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          padding: 0.625rem 0.875rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .upload-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 25%, transparent);
        }
      `}</style>
    </main>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</span>
      {children}
    </label>
  );
}