import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, User, Mail, Lock, Plus, Shield, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import {
  SkeletonLine,
  SkeletonBlock,
  SettingsSectionSkeleton,
} from "@/components/ui/skeleton-loader";
import {
  getMyProfile,
  updateMyProfile,
  addMyTcgId,
  updateMyEmail,
  updateMyPassword,
} from "@/lib/geekarena-settings.functions";
import ReactDOM from "react-dom";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuración — Geek Arena" }] }),
  component: SettingsPage,
});

function SettingsSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = Math.min(options.length * 42, 240); // max-h-60 = 240px
      const goUp = spaceBelow < dropdownHeight + 8;

      setPos({
        top: goUp
          ? rect.top - dropdownHeight - 4 // abre hacia arriba
          : rect.bottom + 4, // abre hacia abajo
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:border-white/20"
      >
        <span className={selected ? "text-white" : "text-gray-500"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 99999,
            }}
            className="rounded-md border border-white/10 bg-[#0f1117] shadow-xl"
          >
            <div className="max-h-60 overflow-y-auto">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition hover:bg-white/10 ${
                    o.value === value ? "text-primary font-semibold" : "text-white"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

type TcgId = {
  id: string;
  game_id: string;
  game_name: string;
  tcg_user_id: string;
  created_at: string;
};
type Game = { id: string; name: string };

function SettingsPage() {
  const fetchProfile = useServerFn(getMyProfile);
  const callUpdateProfile = useServerFn(updateMyProfile);
  const callAddTcgId = useServerFn(addMyTcgId);
  const callUpdateEmail = useServerFn(updateMyEmail);
  const callUpdatePassword = useServerFn(updateMyPassword);

  const [loading, setLoading] = useState(true);
  const [playerRole, setPlayerRole] = useState<string>("");
  const [tcgIds, setTcgIds] = useState<TcgId[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);

  const [geekTag, setGeekTag] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentGeekTag, setCurrentGeekTag] = useState("");
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentEmail, setCurrentEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [selectedGameId, setSelectedGameId] = useState("");
  const [newTcgUserId, setNewTcgUserId] = useState("");
  const [savingTcgId, setSavingTcgId] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((res: any) => {
        setCurrentGeekTag(res.profile?.geek_tag ?? "");
        setCurrentDisplayName(res.profile?.display_name ?? "");
        setCurrentEmail(res.profile?.email ?? "");
        setPlayerRole(res.profile?.role ?? "player");
        setTcgIds(res.tcg_ids ?? []);
        setAllGames(res.all_games ?? []);
      })
      .catch(() => toast.error("Error al cargar tu perfil"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPlayer = playerRole === "player" || playerRole === "";
  const availableGames = allGames.filter((g) => !tcgIds.some((t) => t.game_id === g.id));

  const onSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await callUpdateProfile({
        data: {
          geek_tag: geekTag.trim() || currentGeekTag,
          display_name: displayName.trim() || currentDisplayName,
        },
      });
      toast.success("Perfil actualizado correctamente");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSavingProfile(false);
    }
  };

  const onUpdateEmail = async () => {
    if (!newEmail) return;
    setSavingEmail(true);
    try {
      const res = (await callUpdateEmail({ data: { new_email: newEmail } })) as any;
      toast.success(res?.message ?? "Email actualizado");
      setNewEmail("");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al actualizar email");
    } finally {
      setSavingEmail(false);
    }
  };

  const onUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSavingPassword(true);
    try {
      await callUpdatePassword({ data: { new_password: newPassword } });
      toast.success("Contraseña actualizada correctamente");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cambiar contraseña");
    } finally {
      setSavingPassword(false);
    }
  };

  const onAddTcgId = async () => {
    if (!selectedGameId || !newTcgUserId.trim()) return;
    setSavingTcgId(true);
    try {
      await callAddTcgId({ data: { game_id: selectedGameId, tcg_user_id: newTcgUserId.trim() } });
      toast.success("ID de TCG agregado correctamente");
      setNewTcgUserId("");
      setSelectedGameId("");
      const res = (await fetchProfile()) as any;
      setTcgIds(res.tcg_ids ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al agregar ID");
    } finally {
      setSavingTcgId(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <div className="h-2 w-20 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-7 w-40 rounded bg-white/[0.06] animate-pulse" />
        </header>

        {/* Perfil skeleton */}
        <div className="glass space-y-4 rounded-2xl p-6">
          <SkeletonLine width="w-40" height="h-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <SkeletonLine width="w-16" height="h-2" />
              <SkeletonBlock className="h-9 w-full rounded-md" />
              <SkeletonLine width="w-32" height="h-2" />
            </div>
            <div className="space-y-2">
              <SkeletonLine width="w-24" height="h-2" />
              <SkeletonBlock className="h-9 w-full rounded-md" />
              <SkeletonLine width="w-28" height="h-2" />
            </div>
          </div>
          <SkeletonLine width="w-32" height="h-8" className="rounded-lg" />
        </div>

        {/* Email skeleton */}
        <div className="glass space-y-4 rounded-2xl p-6">
          <SkeletonLine width="w-32" height="h-4" />
          <SkeletonLine width="w-full" height="h-3" />
          <SkeletonLine width="w-48" height="h-3" />
          <div className="flex gap-2">
            <SkeletonBlock className="h-9 flex-1 rounded-md" />
            <SkeletonLine width="w-24" height="h-9" className="rounded-lg" />
          </div>
        </div>

        {/* Password skeleton */}
        <div className="glass space-y-4 rounded-2xl p-6">
          <SkeletonLine width="w-40" height="h-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <SkeletonLine width="w-28" height="h-2" />
              <SkeletonBlock className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <SkeletonLine width="w-32" height="h-2" />
              <SkeletonBlock className="h-9 w-full rounded-md" />
            </div>
          </div>
          <SkeletonLine width="w-36" height="h-8" className="rounded-lg" />
        </div>

        {/* TCG IDs skeleton */}
        <div className="glass space-y-4 rounded-2xl p-6">
          <SkeletonLine width="w-32" height="h-4" />
          <SkeletonLine width="w-full" height="h-3" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2.5"
              >
                <div className="space-y-1.5">
                  <SkeletonLine width="w-20" height="h-2" />
                  <SkeletonLine width="w-32" height="h-4" />
                </div>
                <SkeletonLine width="w-20" height="h-5" className="rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Mi cuenta</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Configuración</h1>
      </header>

      {/* Perfil */}
      <section className="glass space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <User size={14} className="text-primary" /> Información de perfil
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Geek Tag</label>
            <input
              value={geekTag}
              onChange={(e) => setGeekTag(e.target.value)}
              placeholder={currentGeekTag}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-gray-600"
            />
            <p className="text-[10px] text-gray-500">Visible públicamente en rankings y torneos.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Nombre para mostrar</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={currentDisplayName}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-gray-600"
            />
            <p className="text-[10px] text-gray-500">Nombre visible en tu perfil público.</p>
          </div>
        </div>
        <button
          onClick={onSaveProfile}
          disabled={savingProfile}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {savingProfile ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Guardar cambios
        </button>
      </section>

      {/* Email */}
      <section className="glass space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Mail size={14} className="text-primary" /> Cambiar email
        </h2>
        <p className="text-xs text-gray-400">
          Recibirás un correo de confirmación en tu nuevo email antes de que el cambio sea efectivo.
        </p>
        {currentEmail && (
          <p className="text-xs text-gray-500">
            Email actual: <span className="font-mono text-gray-300">{currentEmail}</span>
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nuevo@email.com"
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
          />
          <button
            onClick={onUpdateEmail}
            disabled={savingEmail || !newEmail}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingEmail ? <Loader2 size={12} className="animate-spin" /> : "Actualizar"}
          </button>
        </div>
      </section>

      {/* Contraseña */}
      <section className="glass space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Lock size={14} className="text-primary" /> Cambiar contraseña
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              className={`w-full rounded-md border bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary ${
                confirmPassword.length > 0 && confirmPassword !== newPassword
                  ? "border-red-500/50"
                  : "border-white/10"
              }`}
            />
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-[10px] text-red-400">Las contraseñas no coinciden</p>
            )}
            {confirmPassword.length > 0 &&
              confirmPassword === newPassword &&
              newPassword.length >= 8 && (
                <p className="text-[10px] text-emerald-400">✓ Las contraseñas coinciden</p>
              )}
          </div>
        </div>

        <PasswordStrength password={newPassword} />

        <button
          onClick={onUpdatePassword}
          disabled={
            savingPassword ||
            newPassword.length < 8 ||
            newPassword !== confirmPassword ||
            !/[A-Z]/.test(newPassword) ||
            !/[a-z]/.test(newPassword) ||
            !/[0-9]/.test(newPassword)
          }
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {savingPassword ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
          Cambiar contraseña
        </button>
      </section>

      {/* TCG IDs — solo jugadores */}
      {isPlayer && (
        <section className="glass space-y-4 rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <Shield size={14} className="text-primary" /> Mis IDs de TCG
          </h2>
          <p className="text-xs text-gray-400">
            Una vez registrado un ID, no puede ser modificado. Si hay un error, contacta a un
            administrador.
          </p>

          {tcgIds.length > 0 && (
            <div className="space-y-2">
              {tcgIds.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-semibold text-primary">{t.game_name}</p>
                    <p className="font-mono text-sm text-white">{t.tcg_user_id}</p>
                  </div>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-gray-500">
                    Solo lectura
                  </span>
                </div>
              ))}
            </div>
          )}

          {availableGames.length > 0 ? (
            <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-gray-300">Agregar nuevo ID de TCG</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <SettingsSelect
                  value={selectedGameId}
                  onChange={setSelectedGameId}
                  placeholder="Selecciona el TCG"
                  options={availableGames.map((g) => ({ value: g.id, label: g.name }))}
                />
                <input
                  value={newTcgUserId}
                  onChange={(e) => setNewTcgUserId(e.target.value)}
                  placeholder="Tu ID de jugador"
                  className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                />
                <button
                  onClick={onAddTcgId}
                  disabled={savingTcgId || !selectedGameId || !newTcgUserId.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingTcgId ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plus size={12} />
                  )}
                  Agregar
                </button>
              </div>
              <p className="text-[10px] text-amber-400">
                ⚠️ Una vez guardado, este ID no podrá modificarse. Verifica que sea correcto antes
                de agregar.
              </p>
            </div>
          ) : tcgIds.length > 0 ? (
            <p className="text-xs text-gray-500">
              Ya tienes IDs registrados para todos los TCGs disponibles.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
