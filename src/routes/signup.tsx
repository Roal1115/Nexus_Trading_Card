import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { geekarena, type Game } from "@/integrations/geekarena/client";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Join the Circuit — Geek Arena" }] }),
  component: SignupPage,
});

const TAG_RE = /^[A-Za-z0-9_]{3,30}$/;
const PASS_RE = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const MIN_FORM_MS = 8000;

type TagStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function SignupPage() {
  const navigate = useNavigate();
  const renderedAt = useRef<number>(Date.now());

  // step
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // step 1
  const [email, setEmail] = useState("");
  const [tag, setTag] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [tagStatus, setTagStatus] = useState<TagStatus>("idle");

  // honeypot — visually hidden via CSS (NOT display:none, NOT type=hidden)
  const [hp, setHp] = useState("");

  // step 2
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // step 3
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  // ---------------- load games ----------------
  useEffect(() => {
    let mounted = true;
    geekarena
      .from("games")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) toast.error("Could not load games");
        setGames((data ?? []) as Game[]);
        setGamesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // ---------------- debounced tag uniqueness check ----------------
  useEffect(() => {
    if (!tag) {
      setTagStatus("idle");
      return;
    }
    if (!TAG_RE.test(tag)) {
      setTagStatus("invalid");
      return;
    }
    setTagStatus("checking");
    const handle = setTimeout(async () => {
      const { data, error } = await geekarena
        .from("players")
        .select("id")
        .eq("geek_tag", tag)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        setTagStatus("idle");
        return;
      }
      setTagStatus(data ? "taken" : "available");
    }, 500);
    return () => clearTimeout(handle);
  }, [tag]);

  // ---------------- step 1 validation ----------------
  const step1Errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Invalid email";
    if (tag && !TAG_RE.test(tag))
      e.tag = "3–30 chars, letters / numbers / underscores only";
    if (password && !PASS_RE.test(password))
      e.password = "Min 8 chars, 1 number, 1 special character";
    if (confirm && confirm !== password) e.confirm = "Passwords don't match";
    return e;
  }, [email, tag, password, confirm]);

  const step1Valid =
    email &&
    tag &&
    password &&
    confirm &&
    Object.keys(step1Errors).length === 0 &&
    tagStatus === "available";

  // ---------------- submit ----------------
  const handleCreate = async () => {
    if (submitting || cooldown) return;

    // honeypot
    if (hp.trim() !== "") {
      // silently fake-succeed
      navigate({ to: "/check-inbox", search: { email } });
      return;
    }

    // time-on-form check
    if (Date.now() - renderedAt.current < MIN_FORM_MS) {
      toast.error("Slow down — that was too fast. Take a moment.");
      return;
    }

    if (!agreed) {
      toast.error("Please confirm the agreement");
      return;
    }
    if (selected.size === 0) {
      toast.error("Pick at least one game");
      return;
    }

    setSubmitting(true);
    const { error } = await geekarena.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          geek_tag: tag,
          game_ids: Array.from(selected),
        },
      },
    });
    setSubmitting(false);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);

    if (error) {
      toast.error(error.message || "Signup failed");
      return;
    }
    // Make sure no auto-session sticks around
    await geekarena.auth.signOut();
    navigate({ to: "/check-inbox", search: { email } });
  };

  // ---------------- UI ----------------
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1e2130] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-400">
            Join the Circuit
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Claim your Geek Tag
          </h1>
        </div>

        <Stepper step={step} />

        {step === 1 && (
          <Step1
            {...{
              email,
              setEmail,
              tag,
              setTag,
              password,
              setPassword,
              confirm,
              setConfirm,
              showPass,
              setShowPass,
              tagStatus,
              step1Errors,
              hp,
              setHp,
            }}
          />
        )}

        {step === 2 && (
          <Step2
            games={games}
            loading={gamesLoading}
            selected={selected}
            toggle={(id) =>
              setSelected((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })
            }
          />
        )}

        {step === 3 && (
          <Step3
            email={email}
            tag={tag}
            games={games.filter((g) => selected.has(g.id))}
            agreed={agreed}
            setAgreed={setAgreed}
          />
        )}

        {/* nav */}
        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="text-xs uppercase tracking-wider text-gray-500 transition hover:text-white"
            >
              ← Back
            </button>
          ) : (
            <Link
              to="/login"
              className="text-xs uppercase tracking-wider text-gray-500 transition hover:text-violet-300"
            >
              Have an account? Sign in
            </Link>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={
                (step === 1 && !step1Valid) ||
                (step === 2 && selected.size === 0)
              }
              className="rounded-md bg-violet-600 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!agreed || submitting || cooldown}
              className="flex items-center gap-2 rounded-md bg-violet-600 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Create My Account
            </button>
          )}
        </div>
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
        /* Honeypot — visually hidden but still in the layout/tab tree for bots */
        .hp-field {
          position: absolute !important;
          left: -10000px !important;
          top: auto;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
      `}</style>
    </main>
  );
}

// ---------------- pieces ----------------

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Identity", "Your Games", "Confirm"];
  return (
    <div className="mb-8 flex items-center gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex flex-1 items-center gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                done
                  ? "border-violet-500 bg-violet-500 text-white"
                  : active
                  ? "border-violet-500 bg-violet-500/10 text-violet-300"
                  : "border-white/10 bg-white/5 text-gray-500"
              }`}
            >
              {done ? <Check size={14} /> : n}
            </div>
            <div className="hidden text-xs uppercase tracking-wider sm:block">
              <span
                className={
                  active || done ? "text-white" : "text-gray-500"
                }
              >
                {label}
              </span>
            </div>
            {i < 2 && (
              <div
                className={`h-px flex-1 ${
                  done ? "bg-violet-500" : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step1(props: {
  email: string;
  setEmail: (s: string) => void;
  tag: string;
  setTag: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  confirm: string;
  setConfirm: (s: string) => void;
  showPass: boolean;
  setShowPass: (b: boolean | ((p: boolean) => boolean)) => void;
  tagStatus: TagStatus;
  step1Errors: Record<string, string>;
  hp: string;
  setHp: (s: string) => void;
}) {
  const {
    email,
    setEmail,
    tag,
    setTag,
    password,
    setPassword,
    confirm,
    setConfirm,
    showPass,
    setShowPass,
    tagStatus,
    step1Errors,
    hp,
    setHp,
  } = props;
  return (
    <div className="space-y-4">
      <Field label="Email" error={step1Errors.email}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="player@geekarena.gg"
          className="input-base"
        />
      </Field>

      {/* Honeypot — visually hidden, must stay empty */}
      <div className="hp-field" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

      <Field
        label="Geek Tag"
        hint="Your unique handle in the Arena. Letters, numbers, underscores."
        error={step1Errors.tag}
        rightHint={<TagBadge status={tagStatus} />}
      >
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value.trim())}
          maxLength={30}
          placeholder="VoidStriker"
          className="input-base"
        />
      </Field>

      <Field label="Password" error={step1Errors.password}>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

      <Field label="Confirm password" error={step1Errors.confirm}>
        <input
          type={showPass ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="input-base"
        />
      </Field>
    </div>
  );
}

function TagBadge({ status }: { status: TagStatus }) {
  if (status === "idle") return null;
  if (status === "checking")
    return (
      <span className="flex items-center gap-1 text-[10px] text-gray-500">
        <Loader2 size={10} className="animate-spin" /> Checking
      </span>
    );
  if (status === "invalid")
    return (
      <span className="text-[10px] text-red-400">Invalid format</span>
    );
  if (status === "available")
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
        <Check size={10} /> Available
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] text-red-400">
      <X size={10} /> Already taken
    </span>
  );
}

function Step2({
  games,
  loading,
  selected,
  toggle,
}: {
  games: Game[];
  loading: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-white">
        Which TCGs do you play?
      </h2>
      <p className="mb-5 text-sm text-gray-400">
        Pick at least one. You can add more later.
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-400" />
        </div>
      ) : games.length === 0 ? (
        <p className="rounded-md border border-white/10 bg-white/5 p-4 text-center text-sm text-gray-400">
          No games available yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {games.map((g) => {
            const on = selected.has(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                className={`group relative flex h-28 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition ${
                  on
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/30"
                }`}
              >
                {on && (
                  <span className="absolute right-2 top-2 rounded-full bg-violet-500 p-1 text-white">
                    <Check size={10} />
                  </span>
                )}
                <span className="text-sm font-semibold text-white">
                  {g.name}
                </span>
                {g.publisher && (
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">
                    {g.publisher}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step3({
  email,
  tag,
  games,
  agreed,
  setAgreed,
}: {
  email: string;
  tag: string;
  games: Game[];
  agreed: boolean;
  setAgreed: (b: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">
        Confirm your account
      </h2>

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <Row label="Email" value={email} />
        <Row label="Geek Tag" value={tag} />
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">
            Games
          </div>
          <div className="flex flex-wrap gap-2">
            {games.map((g) => (
              <span
                key={g.id}
                className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs text-violet-200"
              >
                {g.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 accent-violet-500"
        />
        <span>
          I agree to the{" "}
          <a href="#" className="text-violet-300 hover:underline">
            Terms & Conditions
          </a>{" "}
          and confirm I am a real human.
        </span>
      </label>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-widest text-gray-500">
        {label}
      </span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
  error,
  rightHint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  rightHint?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          {label}
        </label>
        {rightHint}
      </div>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-gray-600">{hint}</p>
      ) : null}
    </div>
  );
}
