import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Swords,
  Users,
  X,
} from "lucide-react";
import { useStore, type PendingSubmission } from "@/lib/mock-store";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Moderation Queue — Geek Collector" }] }),
  component: AdminPage,
});

type DateFilter = "all" | "this-week" | "last-week" | "older" | "specific";

interface PreviewRow {
  rank: number;
  geekTag: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  omw: number;
}

function buildPreviewRows(sub: PendingSubmission): PreviewRow[] {
  // Deterministic mock based on submission id + index so it doesn't reshuffle on re-render.
  let seed = 0;
  for (let i = 0; i < sub.id.length; i++) seed = (seed * 31 + sub.id.charCodeAt(i)) >>> 0;
  const rand = (n: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % n;
  };
  return sub.results.map((r, i) => {
    const wins = 6 - Math.min(i, 3) + (rand(2));
    const losses = i + rand(2);
    const draws = rand(2);
    const omw = Math.round((52 + rand(35)) * 10) / 10;
    return {
      rank: i + 1,
      geekTag: r.geekTag,
      points: r.points,
      wins,
      losses,
      draws,
      omw,
    };
  });
}

function inDateRange(dateStr: string, filter: DateFilter): boolean {
  if (filter === "all" || filter === "specific") return true;
  const d = new Date(dateStr).getTime();
  const now = new Date("2026-05-25").getTime(); // demo "today"
  const day = 24 * 60 * 60 * 1000;
  const thisWeekStart = now - 7 * day;
  const lastWeekStart = now - 14 * day;
  if (filter === "this-week") return d >= thisWeekStart && d <= now;
  if (filter === "last-week") return d >= lastWeekStart && d < thisWeekStart;
  if (filter === "older") return d < lastWeekStart;
  return true;
}

function AdminPage() {
  const { currentUser, pendingSubmissions, approveSubmission, declineSubmission } = useStore();
  const [approvedIds, setApprovedIds] = React.useState<Set<string>>(new Set());
  const [tcg, setTcg] = React.useState<string>("all");
  const [city, setCity] = React.useState<string>("all");
  const [storeQuery, setStoreQuery] = React.useState<string>("");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <ShieldCheck size={32} className="text-primary" />
        <h2 className="mt-3 text-2xl font-bold text-white">Staff only</h2>
        <p className="mt-2 text-sm text-gray-400">Use the Admin demo login to access the moderation queue.</p>
        <Link to="/login" className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground">Sign in</Link>
      </main>
    );
  }

  const cities = Array.from(new Set(pendingSubmissions.map((s) => s.city))).sort();

  const filtered = pendingSubmissions.filter((s) => {
    if (tcg !== "all" && s.tcg !== tcg) return false;
    if (city !== "all" && s.city !== city) return false;
    if (storeQuery && !s.store.toLowerCase().includes(storeQuery.toLowerCase())) return false;
    if (!inDateRange(s.date, dateFilter)) return false;
    return true;
  });

  // Pending first, approved (undo window) sorted to bottom.
  const sorted = [...filtered].sort((a, b) => {
    const ap = approvedIds.has(a.id) ? 1 : 0;
    const bp = approvedIds.has(b.id) ? 1 : 0;
    return ap - bp;
  });

  const handleApprove = (id: string) => {
    setApprovedIds((prev) => new Set(prev).add(id));
  };

  const handleUndo = (id: string) => {
    setApprovedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const handleDecline = (id: string) => {
    declineSubmission(id);
  };

  // Note: approveSubmission (writes to leaderboard) is intentionally NOT called
  // during the 24h undo window in this prototype — it would commit at expiry.
  void approveSubmission;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <header className="my-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Quality Control</p>
          <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl">Pending Submissions</h1>
          <p className="mt-2 text-sm text-gray-400">Approve or decline tournament results before they impact rankings.</p>
        </div>
        <div className="hidden rounded-lg border border-white/10 bg-white/5 px-4 py-2 sm:block">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500">
            <Clock size={12} /> Queue
          </div>
          <div className="font-mono-stat text-2xl font-bold text-primary">
            {pendingSubmissions.length - approvedIds.size}
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="glass mb-6 rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FilterField icon={<Swords size={14} />} label="TCG">
            <select
              value={tcg}
              onChange={(e) => setTcg(e.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none"
            >
              <option value="all" className="bg-neutral-900">All games</option>
              <option value="One Piece" className="bg-neutral-900">One Piece</option>
              <option value="Magic: The Gathering" className="bg-neutral-900">Magic: The Gathering</option>
              <option value="Pokémon" className="bg-neutral-900">Pokémon</option>
            </select>
          </FilterField>

          <FilterField icon={<MapPin size={14} />} label="Location">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none"
            >
              <option value="all" className="bg-neutral-900">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c} className="bg-neutral-900">{c}</option>
              ))}
            </select>
          </FilterField>

          <FilterField icon={<Store size={14} />} label="Store">
            <div className="flex w-full items-center gap-2">
              <input
                value={storeQuery}
                onChange={(e) => setStoreQuery(e.target.value)}
                placeholder="Search store…"
                className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
              />
              <Search size={12} className="text-gray-500" />
            </div>
          </FilterField>

          <FilterField icon={<Calendar size={14} />} label="Date">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="w-full bg-transparent text-sm text-white outline-none"
            >
              <option value="all" className="bg-neutral-900">Any time</option>
              <option value="this-week" className="bg-neutral-900">This week</option>
              <option value="last-week" className="bg-neutral-900">Last week</option>
              <option value="older" className="bg-neutral-900">Older</option>
              <option value="specific" className="bg-neutral-900">Specific date…</option>
            </select>
          </FilterField>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="glass rounded-2xl py-20 text-center">
          <ShieldCheck size={32} className="mx-auto text-primary" />
          <h2 className="mt-3 text-lg font-semibold text-white">Queue is clear</h2>
          <p className="mt-1 text-sm text-gray-500">No submissions match your current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              approved={approvedIds.has(s.id)}
              onApprove={() => handleApprove(s.id)}
              onUndo={() => handleUndo(s.id)}
              onDecline={() => handleDecline(s.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 transition focus-within:border-primary/60">
      <span className="text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</div>
        {children}
      </div>
    </label>
  );
}

function SubmissionCard({
  submission,
  approved,
  onApprove,
  onUndo,
  onDecline,
}: {
  submission: PendingSubmission;
  approved: boolean;
  onApprove: () => void;
  onUndo: () => void;
  onDecline: () => void;
}) {
  const rows = React.useMemo(() => buildPreviewRows(submission), [submission]);
  const totalPlayers = submission.results.length;

  return (
    <article
      className={[
        "glass rounded-2xl p-6 transition-all duration-500",
        approved
          ? "opacity-80 border-emerald-400/40 shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_0_40px_-10px_rgba(52,211,153,0.45)]"
          : "",
      ].join(" ")}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{submission.tcg}</p>
          <h3 className="mt-1 truncate text-xl font-bold text-white">{submission.store}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1"><MapPin size={11} /> {submission.city}</span>
            <span className="inline-flex items-center gap-1"><Calendar size={11} /> <span className="font-mono-stat">{submission.date}</span></span>
            <span className="inline-flex items-center gap-1"><Users size={11} /> <span className="font-mono-stat">{totalPlayers}</span> players</span>
          </div>
        </div>
        {approved ? (
          <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Approved · 24h Undo Window
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
            by {submission.organizer}
          </span>
        )}
      </header>

      <div className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-black/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-500">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Geek Tag</th>
              <th className="px-3 py-2 text-right font-medium">Pts</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">W</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">L</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">D</th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell">OMW%</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((r) => (
              <tr key={r.rank} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-1.5 font-mono-stat text-xs text-gray-500">{r.rank}</td>
                <td className="px-3 py-1.5 text-white">{r.geekTag}</td>
                <td className="px-3 py-1.5 text-right font-mono-stat font-semibold text-primary">+{r.points}</td>
                <td className="hidden px-3 py-1.5 text-right font-mono-stat text-gray-300 sm:table-cell">{r.wins}</td>
                <td className="hidden px-3 py-1.5 text-right font-mono-stat text-gray-300 sm:table-cell">{r.losses}</td>
                <td className="hidden px-3 py-1.5 text-right font-mono-stat text-gray-300 sm:table-cell">{r.draws}</td>
                <td className="hidden px-3 py-1.5 text-right font-mono-stat text-gray-300 md:table-cell">{r.omw.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 5 && (
          <div className="border-t border-white/5 px-3 py-1.5 text-[10px] uppercase tracking-widest text-gray-500">
            + {rows.length - 5} more rows in CSV
          </div>
        )}
      </div>

      {approved ? (
        <button
          onClick={onUndo}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
        >
          <RotateCcw size={14} /> Undo Approval
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            <Check size={14} /> Approve &amp; Publish
          </button>
          <button
            onClick={onDecline}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-destructive transition hover:bg-destructive/20"
          >
            <X size={14} /> Decline
          </button>
        </div>
      )}
    </article>
  );
}