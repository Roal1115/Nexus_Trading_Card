import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { geekarena, type Game } from "@/integrations/geekarena/client";
import { signupPlayer } from "@/lib/geekarena-auth.functions";
import { PasswordStrength, passwordIsValid } from "@/components/ui/PasswordStrength";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Únete al Circuito — Geek Arena" }] }),
  component: SignupPage,
});

const TAG_RE = /^[A-Za-z0-9_]{3,30}$/;

const MIN_FORM_MS = 8000;

type TagStatus = "idle" | "checking" | "available" | "taken" | "invalid";
type Step = 1 | 2 | 3 | 4;
type Gender = "hombre" | "mujer" | "no_especificado";

const TCG_ID_CONFIG: Record<
  string,
  { label: string; placeholder: string; disclaimer?: string }
> = {
  "one-piece": { label: "Bandai ID", placeholder: "Ej: 0000198276" },
  "dragon-ball": { label: "Bandai ID", placeholder: "Ej: 0000198276" },
  "gundam": { label: "Bandai ID", placeholder: "Ej: 0000198276" },
  "riftbound": {
    label: "User ID de Limitless",
    placeholder: "Ej: user_abc123",
  },
  "pokemon": {
    label: "Player ID de Pokémon TCG Live",
    placeholder: "Ej: Trainer12345",
  },
  "magic-the-gathering": {
    label: "Username de MTG Companion",
    placeholder: "Ej: WizardPlayer99",
    disclaimer:
      "⚠️ Aviso importante: Debido a las políticas de privacidad de Wizards of the Coast, no se comparten IDs ni correos electrónicos. El Username de Companion que ingreses aquí será tu identificador permanente en todo el circuito y no podrá cambiarse.",
  },
};

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("user already"))
    return "Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?";
  if (m.includes("email address") && m.includes("invalid"))
    return "Ese correo fue rechazado por el servidor. Usa un correo real (Gmail, Outlook, etc.) — no funciona test@…";
  if (m.includes("invalid email"))
    return "Ingresa un correo electrónico válido";
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit"))
    return "Se enviaron demasiados correos. Espera ~1 hora antes de intentar de nuevo.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera un momento e intenta de nuevo";
  if (m.includes("password"))
    return "La contraseña debe tener mínimo 8 caracteres, un número y un carácter especial";
  return msg || "Ocurrió un error. Verifica tu conexión e intenta de nuevo";
}

function SignupPage() {
  const navigate = useNavigate();
  const renderedAt = useRef<number>(Date.now());

  const [step, setStep] = useState<Step>(1);

  // step 1
  const [email, setEmail] = useState("");
  const [tag, setTag] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [tagStatus, setTagStatus] = useState<TagStatus>("idle");

  // honeypot
  const [hp, setHp] = useState("");

  // step 2
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tcgIds, setTcgIds] = useState<Record<string, string>>({});

  // step 3 — demographics
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");

  // step 4
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    let mounted = true;
    geekarena
      .from("games")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) toast.error("No se pudieron cargar los juegos");
        setGames((data ?? []) as Game[]);
        setGamesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
        .select("id, auth_user_id")
        .eq("geek_tag", tag)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        setTagStatus("idle");
        return;
      }
      if (data && data.auth_user_id) {
        setTagStatus("taken");
      } else {
        setTagStatus("available");
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [tag]);

  const toggleGame = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setTcgIds((p) => {
          const copy = { ...p };
          delete copy[id];
          return copy;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setTcgId = (gameId: string, value: string) =>
    setTcgIds((prev) => ({ ...prev, [gameId]: value }));

  const step1Errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      e.email = "Ingresa un correo electrónico válido";
    if (tag && !TAG_RE.test(tag))
      e.tag = "3 a 30 caracteres. Solo letras, números y guiones bajos";
    if (password && !passwordIsValid(password))
      e.password =
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número";
    if (confirm && confirm !== password)
      e.confirm = "Las contraseñas no coinciden";
    return e;
  }, [email, tag, password, confirm]);

  const step1Valid =
    email &&
    tag &&
    password &&
    passwordIsValid(password) &&
    confirm &&
    Object.keys(step1Errors).length === 0 &&
    tagStatus === "available";

  const step2Valid =
    selected.size > 0 &&
    Array.from(selected).every(
      (gameId) => (tcgIds[gameId] ?? "").trim().length > 0,
    );

  const step3Valid = gender !== "" && birthDate !== "";

  const signupFn = useServerFn(signupPlayer);

  const handleCreate = async () => {
    if (submitting || cooldown) return;

    if (hp.trim() !== "") {
      navigate({ to: "/check-inbox", search: { email } });
      return;
    }

    if (Date.now() - renderedAt.current < MIN_FORM_MS) {
      toast.error("Algo salió mal. Intenta de nuevo.");
      return;
    }

    if (!agreed) {
      toast.error("Debes aceptar los Términos y Condiciones");
      return;
    }
    if (selected.size === 0) {
      toast.error("Debes seleccionar al menos un juego");
      return;
    }
    if (!step2Valid) {
      toast.error("Falta el ID de jugador para uno de los juegos seleccionados");
      return;
    }
    if (!step3Valid) {
      toast.error("Completa tus datos demográficos");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signupFn({
        data: {
          email,
          password,
          geek_tag: tag,
          game_ids: Array.from(selected),
          tcg_ids: tcgIds,
          gender: gender as Gender,
          birth_date: birthDate,
        },
      });

      const { error: resendErr } = await geekarena.auth.resend({
        type: "signup",
        email: result.email,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (resendErr) {
        toast.error(translateAuthError(resendErr.message));
        return;
      }

      await geekarena.auth.signOut();
      navigate({ to: "/check-inbox", search: { email: result.email } });
    } catch (err: any) {
      toast.error(translateAuthError(err?.message ?? ""));
    } finally {
      setSubmitting(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 3000);
    }
  };

  const canContinue =
    (step === 1 && step1Valid) ||
    (step === 2 && step2Valid) ||
    (step === 3 && step3Valid);

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-2xl rounded-2xl p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Únete al Circuito
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Reclama tu Geek Tag
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
            toggle={toggleGame}
            tcgIds={tcgIds}
            setTcgId={setTcgId}
          />
        )}

        {step === 3 && (
          <Step3Demographics
            gender={gender}
            setGender={setGender}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
          />
        )}

        {step === 4 && (
          <Step4Confirm
            email={email}
            tag={tag}
            games={games.filter((g) => selected.has(g.id))}
            agreed={agreed}
            setAgreed={setAgreed}
          />
        )}

        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="text-xs uppercase tracking-wider text-gray-500 transition hover:text-white"
            >
              ← Atrás
            </button>
          ) : (
            <Link
              to="/login"
              className="text-xs uppercase tracking-wider text-gray-500 transition hover:text-primary"
            >
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canContinue}
              className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!agreed || submitting || cooldown}
              className="flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Crear mi cuenta
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
          border-color: #E86A22;
          box-shadow: 0 0 0 3px rgba(232,106,34,0.25);
        }
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

function Stepper({ step }: { step: Step }) {
  const labels = ["Identidad", "Tus Juegos", "Datos", "Confirmación"];
  return (
    <div className="mb-8 flex items-center gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex flex-1 items-center gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-gray-500"
              }`}
            >
              {done ? <Check size={14} /> : n}
            </div>
            <div className="hidden text-xs uppercase tracking-wider sm:block">
              <span className={active || done ? "text-white" : "text-gray-500"}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={`h-px flex-1 ${done ? "bg-primary" : "bg-white/10"}`}
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
      <Field label="Correo electrónico" error={step1Errors.email}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jugador@geekarena.gg"
          className="input-base"
        />
      </Field>

      <div className="hp-field" aria-hidden="true">
        <label>
          Sitio web
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
        label="Tu Geek Tag"
        hint="Tu handle único en la Arena. Letras, números y guiones bajos."
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

      <Field label="Contraseña" error={step1Errors.password}>
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
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <PasswordStrength password={password} />
      </Field>

      <Field label="Confirmar contraseña" error={step1Errors.confirm}>
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
        <Loader2 size={10} className="animate-spin" /> Verificando
      </span>
    );
  if (status === "invalid")
    return <span className="text-[10px] text-red-400">Formato inválido</span>;
  if (status === "available")
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
        <Check size={10} /> Disponible
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] text-red-400">
      <X size={10} /> Ya está en uso
    </span>
  );
}

function Step2({
  games,
  loading,
  selected,
  toggle,
  tcgIds,
  setTcgId,
}: {
  games: Game[];
  loading: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  tcgIds: Record<string, string>;
  setTcgId: (gameId: string, value: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-white">
        ¿Qué TCGs juegas?
      </h2>
      <p className="mb-5 text-sm text-gray-400">
        Selecciona los juegos en los que participas e ingresa tu ID en cada uno.
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : games.length === 0 ? (
        <p className="rounded-md border border-white/10 bg-white/5 p-4 text-center text-sm text-gray-400">
          Aún no hay juegos disponibles.
        </p>
      ) : (
        <div className="space-y-3">
          {games.map((g) => {
            const on = selected.has(g.id);
            const config =
              TCG_ID_CONFIG[g.slug ?? ""] ?? {
                label: "ID de jugador",
                placeholder: "Tu ID",
              };
            return (
              <div
                key={g.id}
                className="overflow-hidden rounded-xl border border-white/10"
              >
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  className={`flex w-full items-center justify-between px-4 py-3 transition ${
                    on
                      ? "border-primary bg-primary/10"
                      : "bg-white/[0.03] hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                        on ? "border-primary bg-primary" : "border-white/20"
                      }`}
                    >
                      {on && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {g.name}
                    </span>
                  </div>
                  {g.publisher && (
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      {g.publisher}
                    </span>
                  )}
                </button>

                {on && (
                  <div className="space-y-2 border-t border-white/10 bg-black/20 px-4 py-3">
                    {config.disclaimer && (
                      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-300">
                        {config.disclaimer}
                      </div>
                    )}
                    <Field
                      label={config.label}
                      hint="Requerido para participar en el circuito"
                    >
                      <input
                        type="text"
                        value={tcgIds[g.id] ?? ""}
                        onChange={(e) => setTcgId(g.id, e.target.value)}
                        placeholder={config.placeholder}
                        className="input-base"
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step3Demographics({
  gender,
  setGender,
  birthDate,
  setBirthDate,
}: {
  gender: Gender | "";
  setGender: (g: Gender) => void;
  birthDate: string;
  setBirthDate: (d: string) => void;
}) {
  const maxDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 5)
    .toISOString()
    .split("T")[0];

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Datos demográficos</h2>
      <p className="text-sm text-gray-400">
        Esta información es de uso interno del circuito y no será visible
        públicamente.
      </p>

      <Field label="Género *">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "hombre", label: "Hombre" },
              { value: "mujer", label: "Mujer" },
              { value: "no_especificado", label: "No especificado" },
            ] as { value: Gender; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGender(opt.value)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                gender === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Fecha de nacimiento *">
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          max={maxDate}
          className="input-base"
        />
        <p className="mt-1 text-[11px] text-gray-600">
          Tu fecha de nacimiento no será visible para otros usuarios.
        </p>
      </Field>
    </div>
  );
}

function Step4Confirm({
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
      <h2 className="text-xl font-semibold text-white">Revisa tu información</h2>

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <Row label="Correo" value={email} />
        <Row label="Geek Tag" value={tag} />
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">
            Juegos
          </div>
          <div className="flex flex-wrap gap-2">
            {games.map((g) => (
              <span
                key={g.id}
                className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary/80"
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
          className="mt-1 h-4 w-4 accent-primary"
        />
        <span>
          Acepto los{" "}
          <a href="#" className="text-primary hover:underline">
            Términos y Condiciones
          </a>{" "}
          y confirmo que soy una persona real.
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
