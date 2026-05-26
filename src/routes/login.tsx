import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { geekarena } from "@/integrations/geekarena/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Geek Arena" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);

  const startCooldown = () => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown) return;
    setLoading(true);
    setNeedsConfirm(null);

    const { data, error } = await geekarena.auth.signInWithPassword({ email, password });
    setLoading(false);
    startCooldown();

    if (error) {
      // Supabase returns "Email not confirmed" when applicable
      if (/not confirmed/i.test(error.message)) {
        setNeedsConfirm(email);
        return;
      }
      toast.error(error.message || "Sign in failed");
      return;
    }
    if (!data.user?.email_confirmed_at) {
      setNeedsConfirm(email);
      await geekarena.auth.signOut();
      return;
    }
    toast.success("Welcome back to the Arena");
    navigate({ to: "/dashboard" });
  };

  const resend = async () => {
    if (!needsConfirm) return;
    const { error } = await geekarena.auth.resend({ type: "signup", email: needsConfirm });
    if (error) toast.error(error.message);
    else toast.success("Confirmation email sent");
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown) return;
    setLoading(true);
    const { error } = await geekarena.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    startCooldown();
    if (error) toast.error(error.message);
    else toast.success("Reset link sent — check your inbox");
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e2130] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-400">
            Geek Arena
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {forgotMode ? "Recover access" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {forgotMode
              ? "We'll email you a reset link."
              : "Sign in to track your ranking."}
          </p>
        </div>

        {needsConfirm ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-300">
              Please verify your email first. We sent a link to{" "}
              <span className="text-white">{needsConfirm}</span>.
            </p>
            <button
              onClick={resend}
              className="w-full rounded-md border border-violet-500/40 bg-violet-500/10 py-3 text-sm font-bold uppercase tracking-widest text-violet-300 transition hover:bg-violet-500/20"
            >
              Resend email
            </button>
            <button
              onClick={() => setNeedsConfirm(null)}
              className="text-xs uppercase tracking-wider text-gray-500 hover:text-white"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={forgotMode ? sendReset : submit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="player@geekarena.gg"
                className="input-base"
              />
            </Field>

            {!forgotMode && (
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
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
            )}

            <button
              type="submit"
              disabled={loading || cooldown}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {forgotMode ? "Send reset link" : "Enter the Arena"}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setForgotMode((f) => !f)}
                className="text-gray-500 transition hover:text-violet-300"
              >
                {forgotMode ? "← Back to sign in" : "Forgot password?"}
              </button>
              {!forgotMode && (
                <Link
                  to="/signup"
                  className="font-semibold text-violet-300 hover:text-violet-200"
                >
                  No account? Join the Circuit →
                </Link>
              )}
            </div>
          </form>
        )}

        <Link
          to="/"
          className="mt-6 block text-center text-xs uppercase tracking-wider text-gray-600 transition hover:text-violet-300"
        >
          Continue as guest →
        </Link>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(15,17,23,0.6);
          padding: 0.75rem 1rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .input-base:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139,92,246,0.25);
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
