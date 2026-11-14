import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { nexus, type Game } from "@/integrations/nexus/client";
import { signupPlayer } from "@/lib/nexus-auth.functions";
import { PasswordStrength, passwordIsValid } from "@/components/ui/PasswordStrength";
import { TAG_RE, TAG_RULE_MESSAGE } from "@/lib/nexus-tag";
import { BTN_OUTLINE, BTN_PRIMARY, ChipGroup, FOCUS_RING } from "@/components/stores/store-ui";
import {
  AuthShell,
  Field,
  PasswordInput,
  TEXT_LINK,
  authInput,
  fieldProps,
} from "@/components/auth/auth-ui";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Únete al Circuito — Nexus" }] }),
  component: SignupPage,
});

const MIN_FORM_MS = 8000;

type TagStatus = "idle" | "checking" | "available" | "taken" | "invalid";
type Step = 1 | 2 | 3 | 4;
type Gender = "hombre" | "mujer" | "no_especificado";

const TCG_ID_CONFIG: Record<string, { label: string; placeholder: string; disclaimer?: string }> = {
  "one-piece": { label: "Bandai ID", placeholder: "Ej: 0000198276" },
  "dragon-ball": { label: "Bandai ID", placeholder: "Ej: 0000198276" },
  gundam: { label: "Bandai ID", placeholder: "Ej: 0000198276" },
  riftbound: {
    label: "User ID de Limitless",
    placeholder: "Ej: user_abc123",
  },
  pokemon: {
    label: "Player ID de Pokémon TCG Live",
    placeholder: "Ej: Trainer12345",
  },
  "magic-the-gathering": {
    label: "Username de MTG Companion",
    placeholder: "Ej: WizardPlayer99",
    disclaimer:
      "Debido a las políticas de privacidad de Wizards of the Coast, no se comparten IDs ni correos electrónicos. El Username de Companion que ingreses aquí será tu identificador permanente en todo el circuito y no podrá cambiarse.",
  },
};

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("user already"))
    return "Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?";
  if (m.includes("email address") && m.includes("invalid"))
    return "Ese correo fue rechazado por el servidor. Usa un correo real (Gmail, Outlook, etc.) — no funciona test@…";
  if (m.includes("invalid email")) return "Ingresa un correo electrónico válido";
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
    nexus
      .from("games")
      .select("*")
      .eq("is_active", true)
      // Temporada 1: solo One Piece, ya seleccionado.
      .eq("slug", "one-piece")
      .order("name")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) toast.error("No se pudieron cargar los juegos");
        setGames((data ?? []) as Game[]);
        setSelected(new Set((data ?? []).map((g) => g.id)));
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
      const { data, error } = await nexus
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
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Ingresa un correo electrónico válido";
    if (tag && !TAG_RE.test(tag)) e.tag = TAG_RULE_MESSAGE;
    if (password && !passwordIsValid(password))
      e.password =
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número";
    if (confirm && confirm !== password) e.confirm = "Las contraseñas no coinciden";
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
    Array.from(selected).every((gameId) => (tcgIds[gameId] ?? "").trim().length > 0);

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

      const { error: resendErr } = await nexus.auth.resend({
        type: "signup",
        email: result.email,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (resendErr) {
        toast.error(translateAuthError(resendErr.message));
        return;
      }

      await nexus.auth.signOut();
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
    (step === 1 && step1Valid) || (step === 2 && step2Valid) || (step === 3 && step3Valid);

  // Al cambiar de paso, el foco va al título del paso para que el lector de pantalla lo anuncie.
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepTitleRef.current?.focus();
  }, [step]);

  return (
    <AuthShell
      wide
      title="Reclama tu Nexus Tag"
      description="Crea tu cuenta del circuito en cuatro pasos."
      footer={
        <p className="text-foreground-secondary">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className={`${TEXT_LINK} text-foreground`}>
            Inicia sesión
          </Link>
        </p>
      }
    >
      <Stepper step={step} />

      <h2
        ref={stepTitleRef}
        tabIndex={-1}
        className="mt-6 text-xl font-semibold text-foreground outline-none"
      >
        {STEP_TITLES[step - 1]}
      </h2>

      <div className="mt-4">
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
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className={BTN_OUTLINE}
          >
            Atrás
          </button>
        ) : (
          <span />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={!canContinue}
            className={BTN_PRIMARY}
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={!agreed || submitting || cooldown}
            className={BTN_PRIMARY}
          >
            {submitting && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
            {submitting ? "Creando…" : "Crear mi cuenta"}
          </button>
        )}
      </div>
    </AuthShell>
  );
}

const STEP_LABELS = ["Tu cuenta", "Tu ID", "Tus datos", "Confirmar"];
const STEP_TITLES = ["Tu cuenta", "Tu Bandai ID", "Datos demográficos", "Revisa tu información"];

/** Pasos: cian solo en el actual (dónde estás); los hechos van neutros con palomita. */
function Stepper({ step }: { step: Step }) {
  return (
    <div>
      <p className="font-mono-stat text-sm text-foreground-subtle sm:hidden">Paso {step} de 4</p>
      <ol aria-label="Pasos del registro" className="hidden items-center gap-2 sm:flex">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className="flex flex-1 items-center gap-2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono-stat text-xs ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : done
                      ? "border-border bg-secondary text-foreground"
                      : "border-border text-foreground-subtle"
                }`}
              >
                {done ? <Check size={14} aria-label="Hecho" /> : n}
              </span>
              <span
                className={`text-sm ${active ? "font-medium text-foreground" : "text-foreground-subtle"}`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              )}
            </li>
          );
        })}
      </ol>
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
  const tagHint = "Tu nombre único en Nexus. Letras, números y guiones bajos.";
  return (
    <div className="space-y-4">
      <Field id="su-email" label="Correo electrónico" error={step1Errors.email}>
        <input
          {...fieldProps("su-email", { error: step1Errors.email })}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="jugador@correo.com"
          className={authInput(step1Errors.email)}
        />
      </Field>

      {/* Honeypot: fuera de pantalla para personas, visible para bots. */}
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
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
        id="su-tag"
        label="Tu Nexus Tag"
        hint={tagHint}
        error={step1Errors.tag}
        aside={<TagBadge status={tagStatus} />}
      >
        <input
          {...fieldProps("su-tag", { error: step1Errors.tag, hint: tagHint })}
          value={tag}
          onChange={(e) => setTag(e.target.value.trim())}
          maxLength={30}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="VoidStriker"
          className={authInput(step1Errors.tag)}
        />
      </Field>

      <Field id="su-pass" label="Contraseña" error={step1Errors.password}>
        <PasswordInput
          {...fieldProps("su-pass", { error: step1Errors.password })}
          show={showPass}
          onToggle={() => setShowPass((s) => !s)}
          error={step1Errors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordStrength password={password} />
      </Field>

      <Field id="su-pass2" label="Confirmar contraseña" error={step1Errors.confirm}>
        <PasswordInput
          {...fieldProps("su-pass2", { error: step1Errors.confirm })}
          show={showPass}
          onToggle={() => setShowPass((s) => !s)}
          error={step1Errors.confirm}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
    </div>
  );
}

function TagBadge({ status }: { status: TagStatus }) {
  if (status === "idle") return null;
  const base = "flex items-center gap-1 text-xs";
  return (
    <span aria-live="polite" className={base}>
      {status === "checking" ? (
        <span className="flex items-center gap-1 text-foreground-subtle">
          <Loader2 size={14} aria-hidden="true" className="animate-spin" /> Verificando
        </span>
      ) : status === "invalid" ? (
        <span className="text-destructive">Formato inválido</span>
      ) : status === "available" ? (
        <span className="flex items-center gap-1 text-success">
          <Check size={14} aria-hidden="true" /> Disponible
        </span>
      ) : (
        <span className="flex items-center gap-1 text-destructive">
          <X size={14} aria-hidden="true" /> Ya está en uso
        </span>
      )}
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
      <p className="text-sm text-foreground-secondary">
        Las tiendas registran tus torneos con este ID. Si no coincide, tus resultados no llegarán a
        tu perfil. Revísalo bien: no se puede cambiar después.
      </p>

      {loading ? (
        <p role="status" className="mt-5 flex items-center gap-2 text-sm text-foreground-secondary">
          <Loader2 size={16} aria-hidden="true" className="animate-spin" />
          Cargando juegos…
        </p>
      ) : games.length === 0 ? (
        <p className="mt-5 text-sm text-foreground-secondary">Aún no hay juegos disponibles.</p>
      ) : (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {games.map((g) => {
            const on = selected.has(g.id);
            const config = TCG_ID_CONFIG[g.slug ?? ""] ?? {
              label: "ID de jugador",
              placeholder: "Tu ID",
            };
            const inputId = `su-tcg-${g.id}`;
            return (
              <li key={g.id} className="py-3">
                {/* Con un solo juego no hay nada que elegir: se muestra como dato, no como casilla. */}
                {games.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    aria-pressed={on}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-md text-left ${FOCUS_RING}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        on ? "border-foreground bg-foreground text-background" : "border-border"
                      }`}
                    >
                      {on && <Check size={14} />}
                    </span>
                    <span className="font-medium text-foreground">{g.name}</span>
                    {g.publisher && (
                      <span className="ml-auto text-xs text-foreground-subtle">{g.publisher}</span>
                    )}
                  </button>
                ) : (
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-foreground">{g.name}</span>
                    {g.publisher && (
                      <span className="text-xs text-foreground-subtle">{g.publisher}</span>
                    )}
                  </p>
                )}

                {on && (
                  <div className="mt-3 space-y-3">
                    {config.disclaimer && (
                      <p className="text-sm text-warning">{config.disclaimer}</p>
                    )}
                    <Field
                      id={inputId}
                      label={config.label}
                      hint="Requerido para participar en el circuito"
                    >
                      <input
                        {...fieldProps(inputId, { hint: true })}
                        type="text"
                        value={tcgIds[g.id] ?? ""}
                        onChange={(e) => setTcgId(g.id, e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={config.placeholder}
                        className={`${authInput()} font-mono-stat`}
                      />
                    </Field>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
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
  const maxDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 5).toISOString().split("T")[0];

  return (
    <div className="space-y-5">
      <p className="text-sm text-foreground-secondary">
        Esta información es de uso interno del circuito y no será visible públicamente.
      </p>

      <div className="space-y-1.5">
        <p id="su-gender-label" className="text-sm font-medium text-foreground-secondary">
          Género
        </p>
        <ChipGroup
          label="Género"
          value={gender || null}
          onChange={(k) => k && setGender(k as Gender)}
          options={[
            { key: "hombre", label: "Hombre" },
            { key: "mujer", label: "Mujer" },
            { key: "no_especificado", label: "No especificado" },
          ]}
        />
      </div>

      <Field id="su-birth" label="Fecha de nacimiento">
        <input
          {...fieldProps("su-birth")}
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          max={maxDate}
          autoComplete="bday"
          className={authInput()}
        />
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
      <dl className="divide-y divide-border border-y border-border text-sm">
        <Row label="Correo" value={email} />
        <Row label="Nexus Tag" value={tag} />
        <Row
          label={games.length === 1 ? "Juego" : "Juegos"}
          value={games.map((g) => g.name).join(", ")}
        />
      </dl>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-foreground-secondary">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-shrink-0 accent-primary"
        />
        <span>
          Acepto los{" "}
          <a href="#" className="text-foreground underline underline-offset-4">
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
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-right text-foreground">{value}</dd>
    </div>
  );
}
