import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { signupStoreOrganizer } from "@/lib/nexus-organizer.functions";
import { PasswordStrength, passwordIsValid } from "@/components/ui/PasswordStrength";

// Ruta oculta: no está enlazada en ninguna navegación pública. Se comparte
// directamente con cada tienda como "/organizer-signup?store=<store_id>".
export const Route = createFileRoute("/organizer-signup")({
  head: () => ({ meta: [{ title: "Registro de tienda — Nexus" }] }),
  validateSearch: (s) => ({ store: (s.store as string) ?? "" }),
  component: OrganizerSignupPage,
});

function translateError(msg: string): string {
  return msg || "Ocurrió un error. Verifica tu conexión e intenta de nuevo";
}

function OrganizerSignupPage() {
  const { store } = Route.useSearch();
  const navigate = useNavigate();
  const signup = useServerFn(signupStoreOrganizer);

  const [email, setEmail] = useState("");
  const [nexusTag, setNexusTag] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!store) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <p className="text-sm text-gray-400">Este link de registro no es válido.</p>
      </main>
    );
  }

  const valid =
    /^\S+@\S+\.\S+$/.test(email) &&
    /^[A-Za-z0-9_]{3,30}$/.test(nexusTag) &&
    passwordIsValid(password) &&
    confirm === password;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await signup({ data: { store_id: store, email, password, geek_tag: nexusTag } });
      const { error } = await nexus.auth.signInWithPassword({ email, password });
      if (error) {
        toast.success("Cuenta creada. Inicia sesión.");
        navigate({ to: "/login" });
        return;
      }
      toast.success("Cuenta de organizador creada");
      navigate({ to: "/organizer/store" });
    } catch (err: any) {
      toast.error(translateError(err?.message ?? ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Registro de Tienda
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Crea tu cuenta de organizador</h1>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tienda@ejemplo.com"
              className="input-base"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Nombre / Nexus Tag
            </label>
            <input
              value={nexusTag}
              onChange={(e) => setNexusTag(e.target.value.trim())}
              maxLength={30}
              placeholder="MiTiendaOrganizer"
              className="input-base"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Contraseña
            </label>
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
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Confirmar contraseña
            </label>
            <input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="input-base"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Crear mi cuenta
          </button>
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
      `}</style>
    </main>
  );
}
