import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Send, Trash2, Upload as UploadIcon } from "lucide-react";
import { useStore, type TCG } from "@/lib/mock-store";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Upload Results — Geek Collector" }] }),
  component: UploadPage,
});

const TCGS: TCG[] = ["One Piece", "Magic: The Gathering", "Pokémon"];

function UploadPage() {
  const { currentUser, submitTournament } = useStore();
  const navigate = useNavigate();
  const [tcg, setTcg] = useState<TCG>("One Piece");
  const [city, setCity] = useState("");
  const [store, setStore] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<{ geekTag: string; points: number }[]>([
    { geekTag: "", points: 0 }, { geekTag: "", points: 0 }, { geekTag: "", points: 0 },
  ]);
  const [submitted, setSubmitted] = useState(false);

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Organizers only</h2>
        <p className="mt-2 text-sm text-gray-400">Sign in as a Tournament Organizer to submit results.</p>
        <Link to="/login" className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground">Sign in</Link>
      </main>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    submitTournament({
      tcg, city, store, date,
      results: rows.filter((r) => r.geekTag.trim() && r.points > 0),
    });
    setSubmitted(true);
    setTimeout(() => navigate({ to: "/" }), 1600);
  };

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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-400">
              <UploadIcon size={14} className="text-primary" /> Player Results
            </h2>
            <button type="button" onClick={() => setRows((r) => [...r, { geekTag: "", points: 0 }])} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:border-primary/50 hover:text-primary">
              <Plus size={12} /> Add Row
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/40 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left w-16">#</th>
                  <th className="px-4 py-2 text-left">Geek Tag</th>
                  <th className="px-4 py-2 text-right">Points Earned</th>
                  <th className="px-4 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-4 py-2 font-mono-stat text-xs text-primary">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-2 py-2">
                      <input
                        value={row.geekTag}
                        onChange={(e) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, geekTag: e.target.value } : r))}
                        placeholder="VoidStriker"
                        className="upload-input"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number" min={0}
                        value={row.points || ""}
                        onChange={(e) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, points: Number(e.target.value) } : r))}
                        placeholder="0"
                        className="upload-input text-right font-mono-stat"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitted}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          <Send size={16} /> {submitted ? "Submitted — Awaiting Approval" : "Submit for Admin Approval"}
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