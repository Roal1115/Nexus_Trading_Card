import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Shield, Store, Sword } from "lucide-react";
import { useStore, type Role } from "@/lib/mock-store";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Geek Collector" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, signup, loginAsDemo } = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tag, setTag] = useState("");
  const [showPass, setShowPass] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") signup(email, tag || email.split("@")[0]);
    else login(email, "player");
    navigate({ to: "/dashboard" });
  };

  const demo = (role: Role) => {
    loginAsDemo(role);
    navigate({ to: role === "admin" ? "/admin" : role === "organizer" ? "/upload" : "/dashboard" });
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">National Circuit</p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {mode === "login" ? "Welcome back" : "Claim your Geek Tag"}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {mode === "login" ? "Sign in to track your ranking." : "Stake your name in the meta."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-md border border-white/10 bg-white/5 p-1 text-xs">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded py-2 font-semibold uppercase tracking-wider transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-gray-400 hover:text-white"
              }`}
            >
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <Field label="Geek Tag" hint="This is your competitive name. Choose wisely.">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                required
                placeholder="VoidStriker"
                className="input-base"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="player@circuit.gg"
              className="input-base"
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-base pr-10"
              />
              <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            className="w-full rounded-md bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            {mode === "login" ? "Enter the Circuit" : "Create My Tag"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-600">
          <div className="h-px flex-1 bg-white/10" /> Demo Access <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <DemoBtn onClick={() => demo("player")} icon={<Sword size={14} />} label="Player" />
          <DemoBtn onClick={() => demo("organizer")} icon={<Store size={14} />} label="Organizer" />
          <DemoBtn onClick={() => demo("admin")} icon={<Shield size={14} />} label="Admin" />
        </div>

        <Link
          to="/"
          className="mt-6 block text-center text-xs uppercase tracking-wider text-gray-500 transition hover:text-primary"
        >
          Continue as Guest — View Leaderboard →
        </Link>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          padding: 0.75rem 1rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .input-base:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 25%, transparent);
        }
      `}</style>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-600">{hint}</p>}
    </div>
  );
}

function DemoBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex flex-col items-center gap-1 rounded-md border border-white/10 bg-white/5 py-2 text-[10px] uppercase tracking-wider text-gray-400 transition hover:border-primary/50 hover:text-primary"
    >
      {icon} {label}
    </button>
  );
}