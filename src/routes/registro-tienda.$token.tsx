import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordStrength, passwordIsValid } from "@/components/ui/PasswordStrength";
import { getStoreInvite, submitStoreSignup } from "@/lib/nexus-store-invites.functions";

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

const fieldClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
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

function StoreSignupPage() {
  const { token } = Route.useParams();
  const fetchInvite = useServerFn(getStoreInvite);
  const submit = useServerFn(submitStoreSignup);

  const [invite, setInvite] = useState<Invite | null>(null);
  const [storeName, setStoreName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

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

  const complete =
    storeName.trim().length >= 2 &&
    city.trim().length >= 2 &&
    state.trim().length >= 2 &&
    phone.trim().length >= 7 &&
    passwordIsValid(password) &&
    password === confirm;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await submit({
        data: { token, password, store_name: storeName, city, state, phone },
      });
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="glass rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-foreground">Registra tu tienda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para {invite.game_name}. Revisaremos tus datos antes de activar tu cuenta.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="Correo de acceso">
            <input value={invite.email} readOnly className={`${fieldClass} opacity-70`} />
          </Field>
          <Field label="Nombre de la tienda">
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={120}
              className={fieldClass}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ciudad">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={120}
                className={fieldClass}
              />
            </Field>
            <Field label="Estado">
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={120}
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label="Teléfono de contacto">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              className={fieldClass}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <PasswordStrength password={password} />
          <Field label="Confirma tu contraseña">
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
            />
          </Field>
          {confirm.length > 0 && confirm !== password && (
            <p className="text-xs text-red-400">Las contraseñas no coinciden</p>
          )}
          <button
            type="submit"
            disabled={!complete || sending}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar solicitud"}
          </button>
        </form>
      </div>
    </main>
  );
}
