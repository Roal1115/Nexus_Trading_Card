import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  SearchSelect,
  storeFieldClass as fieldClass,
  WeekHoursPicker,
} from "@/components/stores/StoreFormFields";
import { PasswordStrength, passwordIsValid } from "@/components/ui/PasswordStrength";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import locations from "@/data/mx-locations.json";
import { getStoreInvite, submitStoreSignup } from "@/lib/nexus-store-invites.functions";
import { CLOSED_WEEK, isValidWeek, type WeekHours } from "@/lib/store-hours";
import {
  AFFILIATION_PLAN_LABELS,
  AFFILIATION_PLANS,
  type AffiliationPlan,
  isGoogleMapsUrl,
} from "@/lib/store-invite-rules";

export const Route = createFileRoute("/registro-tienda/$token")({
  head: () => ({
    meta: [
      { title: "Registro de tienda — Nexus" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: StoreSignupPage,
});

type Invite = Awaited<ReturnType<typeof getStoreInvite>>;

const catalog = locations as Record<string, string[]>;
const STATES = Object.keys(catalog);
const UNKNOWN_ZONE = "__unknown__";

function FieldHead({
  label,
  hint,
  required = true,
}: {
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <>
      <span className="block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-primary">
            *
          </span>
        )}
      </span>
      {hint && <span className="block text-xs text-foreground/70">{hint}</span>}
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-400">{message}</p> : null;
}

function Field({
  name,
  label,
  hint,
  error,
  required,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div id={`field-${name}`} className="scroll-mt-6 space-y-1.5">
      <label className="block space-y-1.5">
        <FieldHead label={label} hint={hint} required={required} />
        {children}
      </label>
      <FieldError message={error} />
    </div>
  );
}

// Para controles con varios botones: un <label> activaría el primero al tocar el texto.
function Group({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={`field-${name}`} role="group" aria-label={label} className="scroll-mt-6 space-y-1.5">
      <FieldHead label={label} hint={hint} />
      {children}
      <FieldError message={error} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </main>
  );
}

function ZoneRow({
  value,
  title,
  description,
  selected,
}: {
  value: string;
  title: string;
  description: string;
  selected: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition ${
        selected
          ? "border-primary bg-primary/15 ring-1 ring-primary"
          : "border-border hover:border-foreground/30"
      }`}
    >
      <RadioGroupItem value={value} aria-label={title} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {description && <span className="block text-xs text-foreground/70">{description}</span>}
      </span>
      {selected && (
        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          <Check size={14} /> Elegida
        </span>
      )}
    </label>
  );
}

const handle = (value: string) => value.trim().replace(/^@/, "");

function StoreSignupPage() {
  const { token } = Route.useParams();
  const fetchInvite = useServerFn(getStoreInvite);
  const submit = useServerFn(submitStoreSignup);

  const [invite, setInvite] = useState<Invite | null>(null);
  const [storeName, setStoreName] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [zone, setZone] = useState("");
  const [subzone, setSubzone] = useState("");
  const [phone, setPhone] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [plan, setPlan] = useState<AffiliationPlan | "">("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [week, setWeek] = useState<WeekHours>(CLOSED_WEEK);
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [twitch, setTwitch] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const cities = useMemo(() => catalog[state] ?? [], [state]);

  useEffect(() => {
    fetchInvite({ data: { token } })
      .then(setInvite)
      .catch(() => setInvite({ valid: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!invite) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!invite.valid) {
    return (
      <Message
        title="Este enlace no es válido"
        body="Puede que ya se haya usado o que haya vencido. Pide uno nuevo a quien te lo envió."
      />
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 size={40} className="text-primary" />
        <h1 className="mt-3 text-2xl font-bold text-foreground">Solicitud enviada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu tienda quedó en revisión. Podrás entrar con {invite.email} y tu contraseña cuando la
          aprueben; te lo avisará quien te envió el enlace.
        </p>
      </main>
    );
  }

  const subzones = invite.zones.find((z) => z.name === zone)?.subzones ?? [];

  const websiteValid = !website.trim() || /^https?:\/\/\S+\.\S+/i.test(website.trim());
  const hasPresence = Boolean(
    handle(instagram) || handle(twitter) || handle(twitch) || website.trim(),
  );

  // El orden es el del formulario: al enviar se lleva a la persona al primero.
  const allErrors: Record<string, string | undefined> = {
    name: storeName.trim().length < 2 ? "Escribe el nombre de tu tienda" : undefined,
    managerName: managerName.trim().length < 2 ? "Escribe el nombre del encargado" : undefined,
    managerPhone: managerPhone.trim().length < 7 ? "Escribe el WhatsApp del encargado" : undefined,
    plan: !plan ? "Elige un plan de afiliación" : undefined,
    state: !state ? "Elige tu estado" : undefined,
    city: !city ? "Elige tu ciudad" : undefined,
    zone: !zone ? "Elige una zona o marca «No sé»" : undefined,
    subzone: subzones.length > 0 && !subzone ? "Elige una opción o marca «No sé»" : undefined,
    address: address.trim().length < 5 ? "Escribe calle, número y colonia" : undefined,
    maps: !isGoogleMapsUrl(mapsUrl)
      ? "Pega el enlace que da Google Maps al compartir tu tienda"
      : undefined,
    phone: phone.trim().length < 7 ? "Escribe un teléfono de contacto" : undefined,
    week: !week.some(Boolean)
      ? "Marca al menos un día"
      : !isValidWeek(week)
        ? "La hora de cierre debe ser después de la de apertura"
        : undefined,
    presence: !hasPresence
      ? "Llena al menos una red o tu página web"
      : !websiteValid
        ? "La página web debe empezar con https://"
        : undefined,
    password: !passwordIsValid(password) ? "La contraseña aún no cumple los requisitos" : undefined,
    confirm: confirm !== password || !confirm ? "Las contraseñas no coinciden" : undefined,
  };
  const pending = Object.entries(allErrors).filter(([, message]) => message);
  // Antes de enviar solo se avisa de lo que ya se escribió mal, no de lo que falta llenar.
  const errorFor = (key: string) => {
    if (attempted) return allErrors[key];
    if (key === "maps" && mapsUrl.trim()) return allErrors.maps;
    if (key === "confirm" && confirm) return allErrors.confirm;
    return undefined;
  };

  const goToField = (key: string) => {
    const field = document.getElementById(`field-${key}`);
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    field?.querySelector<HTMLElement>("input, select, button")?.focus({ preventScroll: true });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.length > 0) {
      setAttempted(true);
      goToField(pending[0][0]);
      return;
    }
    setSending(true);
    try {
      await submit({
        data: {
          token,
          password,
          store_name: storeName,
          state,
          city,
          phone,
          manager_name: managerName,
          manager_phone: managerPhone,
          affiliation_plan: plan as AffiliationPlan,
          address,
          google_maps_url: mapsUrl.trim(),
          week,
          zone: zone === UNKNOWN_ZONE ? null : zone,
          subzone: subzones.length > 0 && subzone !== UNKNOWN_ZONE ? subzone : null,
          instagram: handle(instagram),
          twitter: handle(twitter),
          twitch: handle(twitch),
          website: website.trim(),
        },
      });
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const invalid = (key: string) => (errorFor(key) ? true : undefined);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="glass rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-foreground">Registra tu tienda</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Para {invite.game_name}. Revisaremos tus datos antes de activar tu cuenta.
        </p>
        <p className="mt-2 text-xs text-foreground/70">
          Los campos con <span className="font-semibold text-primary">*</span> son obligatorios.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
          <Section title="Tu tienda">
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field name="name" label="Nombre de la tienda" error={errorFor("name")}>
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  maxLength={120}
                  required
                  aria-invalid={invalid("name")}
                  className={fieldClass}
                />
              </Field>
              <Field name="phone" label="Teléfono de la tienda" error={errorFor("phone")}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  required
                  aria-invalid={invalid("phone")}
                  placeholder="81 1234 5678"
                  className={fieldClass}
                />
              </Field>
            </div>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field
                name="managerName"
                label="Nombre del encargado"
                hint="La persona a cargo de los torneos."
                error={errorFor("managerName")}
              >
                <input
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  required
                  aria-invalid={invalid("managerName")}
                  placeholder="Juan Pérez"
                  className={fieldClass}
                />
              </Field>
              <Field
                name="managerPhone"
                label="WhatsApp del encargado"
                hint="Lo usamos como metodo principal de contacto."
                error={errorFor("managerPhone")}
              >
                <input
                  type="tel"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  maxLength={20}
                  autoComplete="tel"
                  required
                  aria-invalid={invalid("managerPhone")}
                  placeholder="81 1234 5678"
                  className={fieldClass}
                />
              </Field>
            </div>
            <Group name="plan" label="Plan de afiliación" error={errorFor("plan")}>
              <RadioGroup
                value={plan}
                onValueChange={(next) => setPlan(next as AffiliationPlan)}
                aria-label="Plan de afiliación"
                className="sm:grid-cols-3"
              >
                {AFFILIATION_PLANS.map((p) => (
                  <ZoneRow
                    key={p}
                    value={p}
                    title={AFFILIATION_PLAN_LABELS[p]}
                    description=""
                    selected={plan === p}
                  />
                ))}
              </RadioGroup>
            </Group>
          </Section>

          <Section title="Ubicación y zona">
            <div className="grid gap-4 sm:grid-cols-2">
              <Group name="state" label="Estado" error={errorFor("state")}>
                <SearchSelect
                  label="Estado"
                  options={STATES}
                  value={state}
                  placeholder="Busca tu estado"
                  invalid={invalid("state")}
                  onChange={(next) => {
                    setState(next);
                    setCity("");
                  }}
                />
              </Group>
              <Group name="city" label="Ciudad" error={errorFor("city")}>
                <SearchSelect
                  label="Ciudad"
                  options={cities}
                  value={city}
                  placeholder={state ? "Busca tu ciudad" : "Elige primero el estado"}
                  onChange={setCity}
                  disabled={!state}
                  invalid={invalid("city")}
                />
              </Group>
            </div>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field
                name="address"
                label="Dirección"
                hint="Calle, número y colonia."
                error={errorFor("address")}
              >
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={300}
                  required
                  aria-invalid={invalid("address")}
                  className={fieldClass}
                />
              </Field>
              <Field
                name="maps"
                label="Enlace de Google Maps"
                hint="Toca Compartir en Google Maps y pégalo."
                error={errorFor("maps")}
              >
                <input
                  type="url"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  maxLength={500}
                  required
                  aria-invalid={invalid("maps")}
                  placeholder="https://maps.app.goo.gl/..."
                  className={fieldClass}
                />
              </Field>
            </div>
            <Group
              name="zone"
              label="Zona"
              hint="Elige una. Si tienes duda, marca «No sé» y te contactamos."
              error={errorFor("zone")}
            >
              <RadioGroup
                value={zone}
                onValueChange={(next) => {
                  setZone(next);
                  setSubzone("");
                }}
                aria-label="Zona"
                className="sm:grid-cols-2"
              >
                {invite.zones.map((z) => (
                  <ZoneRow
                    key={z.name}
                    value={z.name}
                    title={z.name}
                    description={z.description}
                    selected={zone === z.name}
                  />
                ))}
                <div className="mt-1 border-t border-border pt-3 sm:col-span-2">
                  <ZoneRow
                    value={UNKNOWN_ZONE}
                    title="No sé cuál me toca"
                    description="Un Manager de la plataforma se comunicará contigo para definirla."
                    selected={zone === UNKNOWN_ZONE}
                  />
                </div>
              </RadioGroup>
            </Group>
            {subzones.length > 0 && (
              <Group
                name="subzone"
                label="¿En qué parte de la zona estás?"
                hint="Elige una. Si tienes duda, marca «No sé» y te contactamos."
                error={errorFor("subzone")}
              >
                <RadioGroup
                  value={subzone}
                  onValueChange={setSubzone}
                  aria-label="Subzona"
                  className="sm:grid-cols-2"
                >
                  {subzones.map((s) => (
                    <ZoneRow
                      key={s.name}
                      value={s.name}
                      title={s.name}
                      description={s.description}
                      selected={subzone === s.name}
                    />
                  ))}
                  <div className="mt-1 border-t border-border pt-3 sm:col-span-2">
                    <ZoneRow
                      value={UNKNOWN_ZONE}
                      title="No sé cuál me toca"
                      description="Un Manager de la plataforma se comunicará contigo para definirla."
                      selected={subzone === UNKNOWN_ZONE}
                    />
                  </div>
                </RadioGroup>
              </Group>
            )}
          </Section>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Section title="Horario de la tienda">
              <Group
                name="week"
                label="¿Qué días abres?"
                hint="Si un día es distinto, usa «Horario especial»."
                error={errorFor("week")}
              >
                <WeekHoursPicker initial={CLOSED_WEEK} onChange={setWeek} />
              </Group>
            </Section>
            <Section title="Redes y página web">
              <Group
                name="presence"
                label="¿Dónde te encuentran?"
                hint="Llena al menos una."
                error={errorFor("presence")}
              >
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <input
                    aria-label="Instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    maxLength={100}
                    placeholder="Instagram (@usuario)"
                    className={fieldClass}
                  />
                  <input
                    aria-label="X / Twitter"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    maxLength={100}
                    placeholder="X / Twitter (@usuario)"
                    className={fieldClass}
                  />
                  <input
                    aria-label="Twitch"
                    value={twitch}
                    onChange={(e) => setTwitch(e.target.value)}
                    maxLength={100}
                    placeholder="Twitch (canal)"
                    className={fieldClass}
                  />
                  <input
                    aria-label="Página web"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    maxLength={300}
                    placeholder="https://tu-pagina.com"
                    className={fieldClass}
                  />
                </div>
              </Group>
            </Section>
          </div>

          <Section title="Tu acceso">
            <Field name="email" label="Correo de acceso" required={false}>
              <input value={invite.email} readOnly className={`${fieldClass} opacity-70`} />
            </Field>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field name="password" label="Contraseña" error={errorFor("password")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={invalid("password")}
                  className={fieldClass}
                />
              </Field>
              <Field name="confirm" label="Confirma tu contraseña" error={errorFor("confirm")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  aria-invalid={invalid("confirm")}
                  className={fieldClass}
                />
              </Field>
            </div>
            <PasswordStrength password={password} />
          </Section>

          <div className="space-y-2">
            {attempted && pending.length > 0 && (
              <p role="alert" className="text-center text-sm font-medium text-red-400">
                {pending.length === 1 ? "Falta 1 dato" : `Faltan ${pending.length} datos`}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
