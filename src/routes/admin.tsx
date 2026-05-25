import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, ShieldCheck, X } from "lucide-react";
import { useStore } from "@/lib/mock-store";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Moderation Queue — Geek Collector" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { currentUser, pendingSubmissions, approveSubmission, declineSubmission } = useStore();

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
          <div className="font-mono-stat text-2xl font-bold text-primary">{pendingSubmissions.length}</div>
        </div>
      </header>

      {pendingSubmissions.length === 0 ? (
        <div className="glass rounded-2xl py-20 text-center">
          <ShieldCheck size={32} className="mx-auto text-primary" />
          <h2 className="mt-3 text-lg font-semibold text-white">Queue is clear</h2>
          <p className="mt-1 text-sm text-gray-500">All tournament submissions have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pendingSubmissions.map((s) => (
            <article key={s.id} className="glass rounded-2xl p-6">
              <header className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{s.tcg}</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{s.store}</h3>
                  <p className="text-xs text-gray-400">{s.city} · <span className="font-mono-stat">{s.date}</span></p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                  by {s.organizer}
                </span>
              </header>

              <div className="mb-4 rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-500">
                  <span>Player</span><span>Points</span>
                </div>
                <ul className="space-y-1">
                  {s.results.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-white">
                        <span className="mr-2 font-mono-stat text-xs text-gray-500">#{i + 1}</span>
                        {r.geekTag}
                      </span>
                      <span className="font-mono-stat font-semibold text-primary">+{r.points}</span>
                    </li>
                  ))}
                  {s.results.length > 5 && <li className="text-xs text-gray-500">+ {s.results.length - 5} more…</li>}
                </ul>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => approveSubmission(s.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  onClick={() => declineSubmission(s.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-destructive transition hover:bg-destructive/20"
                >
                  <X size={14} /> Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}