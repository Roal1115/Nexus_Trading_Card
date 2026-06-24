import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, User, Mail, Lock, Plus, Shield, Check } from "lucide-react";
import { toast } from "sonner";
import {
  getMyProfile,
  updateMyProfile,
  addMyTcgId,
  updateMyEmail,
  updateMyPassword,
} from "@/lib/geekarena-settings.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuración — Geek Arena" }] }),
  component: SettingsPage,
});

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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
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

        {newPassword.length > 0 && (
          <div className="space-y-1.5 rounded-md border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">Requisitos</p>
            {[
              { label: "Mínimo 8 caracteres", ok: newPassword.length >= 8 },
              { label: "Al menos una mayúscula", ok: /[A-Z]/.test(newPassword) },
              { label: "Al menos una minúscula", ok: /[a-z]/.test(newPassword) },
              { label: "Al menos un número", ok: /[0-9]/.test(newPassword) },
              {
                label: "Al menos un carácter especial (!@#$%^&*)",
                ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
              },
            ].map((req) => (
              <div key={req.label} className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold ${req.ok ? "text-emerald-400" : "text-gray-600"}`}
                >
                  {req.ok ? "✓" : "○"}
                </span>
                <span className={`text-xs ${req.ok ? "text-emerald-400" : "text-gray-500"}`}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        )}

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
                <select
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                >
                  <option value="">Selecciona el TCG</option>
                  {availableGames.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
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
