import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Mail, Lock, Plus, Shield, Check, ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { PushNotificationsToggle } from "@/components/PushNotificationsToggle";
import {
  SkeletonLine,
  SkeletonBlock,
  SettingsSectionSkeleton,
} from "@/components/ui/skeleton-loader";
import {
  getMyProfile,
  updateMyProfile,
  addMyTcgId,
  setMyHomeStore,
} from "@/lib/nexus-settings.functions";
import { TAG_RE, TAG_RULE_MESSAGE } from "@/lib/nexus-tag";
import { setPlayerPreferences, toggleProfilePrivacy } from "@/lib/nexus-player.functions";
import { useNexusRole } from "@/hooks/use-nexus-role";
import ReactDOM from "react-dom";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuración — Nexus" }] }),
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
  const listRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // La lista vive en un portal: sin revisarla, tocar una opción cerraba antes del click.
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !listRef.current?.contains(target)) {
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
            ref={listRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 99999,
            }}
            className="animate-in fade-in-0 zoom-in-95 duration-150 rounded-md border border-white/10 bg-[#0f1117] shadow-xl"
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
  const { player: authPlayer, loading: authLoading, updatePlayer } = useNexusRole();
  const fetchProfile = useServerFn(getMyProfile);
  const togglePrivacy = useServerFn(toggleProfilePrivacy);
  const savePreferences = useServerFn(setPlayerPreferences);
  const callUpdateProfile = useServerFn(updateMyProfile);
  const callAddTcgId = useServerFn(addMyTcgId);
  const saveHomeStore = useServerFn(setMyHomeStore);
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [playerRole, setPlayerRole] = useState<string>("");
  const [tcgIds, setTcgIds] = useState<TcgId[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);

  const [nexusTag, setNexusTag] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentNexusTag, setCurrentNexusTag] = useState("");
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentEmail, setCurrentEmail] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [zone, setZone] = useState("");
  const [zones, setZones] = useState<string[]>([]);
  const [homeStoreId, setHomeStoreId] = useState("");
  const [stores, setStores] = useState<Array<{ id: string; name: string; city: string | null }>>(
    [],
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [selectedGameId, setSelectedGameId] = useState("");
  const [newTcgUserId, setNewTcgUserId] = useState("");
  const [savingTcgId, setSavingTcgId] = useState(false);

  useEffect(() => {
    if (!authPlayer?.id) return;
    fetchProfile()
      .then((res: any) => {
        setCurrentNexusTag(res.profile?.geek_tag ?? "");
        setCurrentDisplayName(res.profile?.display_name ?? "");
        setCurrentEmail(res.profile?.email ?? "");
        setPlayerRole(res.profile?.role ?? "player");
        setTcgIds(res.tcg_ids ?? []);
        setAllGames(res.all_games ?? []);
        setIsPublic(res.profile?.is_profile_public ?? true);
        setZone(res.profile?.preferred_zone ?? "");
        setZones(res.zones ?? []);
        setHomeStoreId(res.profile?.home_store_id ?? "");
        setStores(res.stores ?? []);
      })
      .catch(() => toast.error("Error al cargar tu perfil"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPlayer?.id]);

  const isPlayer = playerRole === "player" || playerRole === "";
  const availableGames = allGames.filter((g) => !tcgIds.some((t) => t.game_id === g.id));

  const newTag = nexusTag.trim();
  const newName = displayName.trim();
  const tagChanged = !!newTag && newTag !== currentNexusTag;
  const tagInvalid = tagChanged && !TAG_RE.test(newTag);
  const nameChanged = !!newName && newName !== currentDisplayName;

  const onTogglePrivacy = async () => {
    const next = !isPublic;
    setIsPublic(next);
    try {
      await togglePrivacy({ data: { is_public: next } });
      updatePlayer({ is_profile_public: next });
      toast.success(next ? "Tu perfil ahora es público" : "Tu perfil ahora es privado");
    } catch {
      setIsPublic(!next);
      toast.error("No se pudo cambiar la privacidad");
    }
  };

  const onHomeStoreChange = async (value: string) => {
    const previous = homeStoreId;
    setHomeStoreId(value);
    try {
      await saveHomeStore({ data: { store_id: value || null } });
      updatePlayer({ home_store_id: value || null });
      queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
      toast.success("Tienda principal guardada");
    } catch {
      setHomeStoreId(previous);
      toast.error("No se pudo guardar tu tienda principal");
    }
  };

  const onZoneChange = async (value: string) => {
    const previous = zone;
    setZone(value);
    try {
      await savePreferences({
        data: { game_id: authPlayer?.preferred_game_id ?? null, zone: value },
      });
      updatePlayer({ preferred_zone: value });
      toast.success("Zona guardada");
    } catch {
      setZone(previous);
      toast.error("No se pudo guardar tu zona");
    }
  };

  const onSaveProfile = async () => {
    setSavingProfile(true);
    try {
      // Solo lo que cambió: un tag antiguo con otro formato no debe bloquear otros cambios.
      await callUpdateProfile({
        data: {
          ...(tagChanged && { geek_tag: newTag }),
          ...(nameChanged && { display_name: newName }),
        },
      });
      if (tagChanged) {
        setCurrentNexusTag(newTag);
        updatePlayer({ geek_tag: newTag });
      }
      if (nameChanged) setCurrentDisplayName(newName);
      setNexusTag("");
      setDisplayName("");
      toast.success("Perfil actualizado correctamente");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSavingProfile(false);
    }
  };

  const onUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await nexus.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(
          error.code === "same_password"
            ? "La nueva contraseña debe ser diferente a la anterior"
            : "No se pudo cambiar la contraseña. Intenta de nuevo",
        );
      }
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

  if (!authLoading && !authPlayer) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Debes iniciar sesión</h2>
        <Link
          to="/login"
          className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

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
            <label className="text-xs text-gray-400">Nexus Tag</label>
            <input
              value={nexusTag}
              onChange={(e) => setNexusTag(e.target.value)}
              placeholder={currentNexusTag}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-gray-600"
            />
            {tagInvalid ? (
              <p className="text-[10px] text-red-400">{TAG_RULE_MESSAGE}</p>
            ) : (
              <p className="text-[10px] text-gray-500">
                Visible públicamente en rankings y torneos.
              </p>
            )}
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
          disabled={savingProfile || tagInvalid || (!tagChanged && !nameChanged)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {savingProfile ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Guardar cambios
        </button>
      </section>

      {/* Privacidad y preferencias */}
      <section className="glass space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Shield size={14} className="text-primary" /> Privacidad y preferencias
        </h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white">Perfil {isPublic ? "público" : "privado"}</p>
            <p className="text-xs text-gray-500">
              El staff de las tiendas y TCGs donde jugaste siempre puede ver esos resultados.
            </p>
          </div>
          <button
            onClick={onTogglePrivacy}
            className="flex-shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            Hacer {isPublic ? "privado" : "público"}
          </button>
        </div>
        {zones.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Mi zona</label>
            <SettingsSelect
              value={zone}
              onChange={onZoneChange}
              placeholder="Selecciona tu zona"
              options={zones.map((z) => ({ value: z, label: z }))}
            />
            <p className="text-[10px] text-gray-500">El calendario se abre en esta zona.</p>
          </div>
        )}
        {isPlayer && stores.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Mi tienda principal (opcional)</label>
            <SettingsSelect
              value={homeStoreId}
              onChange={onHomeStoreChange}
              placeholder="Sin tienda principal"
              options={[
                { value: "", label: "Sin tienda principal" },
                ...stores.map((s) => ({
                  value: s.id,
                  label: s.city ? `${s.name} · ${s.city}` : s.name,
                })),
              ]}
            />
            <p className="text-[10px] text-gray-500">Se muestra en tu Inicio y en tu perfil.</p>
          </div>
        )}
      </section>

      {/* Email */}
      <section className="glass space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Mail size={14} className="text-primary" /> Email
        </h2>
        {currentEmail && (
          <p className="text-xs text-gray-500">
            Email actual: <span className="font-mono text-gray-300">{currentEmail}</span>
          </p>
        )}
        {/* ponytail: cambio de email apagado hasta tener SMTP propio; después va con
            nexus.auth.updateUser({ email }) aquí y se borra updateMyEmail. */}
        <p className="text-xs text-gray-400">Cambiar tu email estará disponible muy pronto.</p>
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

      <PushNotificationsToggle />

      {/* Zona de cuenta */}
      <section className="mt-8 border-t border-border pt-6">
        <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">Cuenta</p>
        <button
          type="button"
          onClick={async () => {
            await nexus.auth.signOut();
            window.location.href = "/login";
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-95"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}
