import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, ChevronDown } from "lucide-react";
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
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmLogout } from "@/components/layout/ConfirmLogout";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  INPUT,
  InlineError,
  LABEL,
  SECTION,
} from "@/components/stores/store-ui";

const HINT = "text-xs text-foreground-subtle";
const H2 = "text-lg font-semibold text-foreground";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuración — Nexus" }] }),
  component: SettingsPage,
});

function SettingsSelect({
  value,
  onChange,
  options,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  id?: string;
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
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
        id={id}
        type="button"
        onClick={handleOpen}
        aria-haspopup="listbox"
        aria-labelledby={id ? `${id}-label ${id}` : undefined}
        aria-expanded={open}
        className={`${INPUT} flex items-center justify-between gap-2 text-left transition hover:border-foreground-subtle`}
      >
        <span className={`truncate ${selected ? "text-foreground" : "text-foreground-subtle"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="flex-shrink-0 text-foreground-subtle"
        />
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
            className="animate-in fade-in-0 zoom-in-95 duration-150 rounded-md border border-border bg-popover shadow-2xl"
          >
            <div role="listbox" className="max-h-60 overflow-y-auto">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm text-foreground transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                >
                  {o.label}
                  {o.value === value && (
                    <Check
                      size={16}
                      aria-hidden="true"
                      className="flex-shrink-0 text-foreground-secondary"
                    />
                  )}
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

  // Un fallo de carga no es un formulario vacío: se muestra el error con Reintentar.
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!authPlayer?.id) return;
    setLoading(true);
    setLoadFailed(false);
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
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPlayer?.id, retryKey]);

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
        <h1 className="text-2xl font-bold text-foreground">
          Inicia sesión para ver tu configuración
        </h1>
        <Link to="/login" className={`${BTN_PRIMARY} mt-6`}>
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <PageHeader title="Configuración" description="Tu perfil, privacidad y cuenta." />
      {children}
    </main>
  );

  if (loading) {
    return shell(
      <div aria-busy="true" aria-label="Cargando configuración" className="space-y-5">
        {[3, 3, 2, 3].map((rows, i) => (
          <div key={i} className={`${SECTION} space-y-4`}>
            <SkeletonLine width="w-40" height="h-5" />
            {Array.from({ length: rows }).map((_, j) => (
              <div key={j} className="space-y-2">
                <SkeletonLine width="w-28" height="h-3" />
                <SkeletonBlock className="h-11 w-full rounded-md sm:h-9" />
              </div>
            ))}
          </div>
        ))}
      </div>,
    );
  }

  if (loadFailed) {
    return shell(
      <section className={SECTION}>
        <InlineError onRetry={() => setRetryKey((k) => k + 1)}>
          No pudimos cargar tu configuración.
        </InlineError>
      </section>,
    );
  }

  const passwordReady =
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[0-9]/.test(newPassword);
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  return shell(
    <>
      {/* Perfil */}
      <section aria-labelledby="s-perfil" className={`${SECTION} space-y-4`}>
        <h2 id="s-perfil" className={H2}>
          Perfil
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="set-tag" className={LABEL}>
              Nexus Tag
            </label>
            <input
              id="set-tag"
              value={nexusTag}
              onChange={(e) => setNexusTag(e.target.value)}
              placeholder={currentNexusTag}
              aria-invalid={tagInvalid}
              aria-describedby="set-tag-hint"
              autoComplete="off"
              className={`${INPUT} ${tagInvalid ? "border-destructive" : ""}`}
            />
            <p id="set-tag-hint" className={tagInvalid ? "text-xs text-destructive" : HINT}>
              {tagInvalid ? TAG_RULE_MESSAGE : "Visible públicamente en rankings y torneos."}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="set-name" className={LABEL}>
              Nombre para mostrar
            </label>
            <input
              id="set-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={currentDisplayName}
              aria-describedby="set-name-hint"
              autoComplete="nickname"
              className={INPUT}
            />
            <p id="set-name-hint" className={HINT}>
              Nombre visible en tu perfil público.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSaveProfile}
          disabled={savingProfile || tagInvalid || (!tagChanged && !nameChanged)}
          className={BTN_PRIMARY}
        >
          {savingProfile && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
          {savingProfile ? "Guardando…" : "Guardar cambios"}
        </button>
      </section>

      {/* Privacidad y preferencias */}
      <section aria-labelledby="s-priv" className={SECTION}>
        <h2 id="s-priv" className={H2}>
          Privacidad y preferencias
        </h2>
        <div className="mt-2 divide-y divide-border">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                Perfil {isPublic ? "público" : "privado"}
              </p>
              <p className="mt-0.5 text-sm text-foreground-secondary">
                El staff de las tiendas y TCGs donde jugaste siempre puede ver esos resultados.
              </p>
            </div>
            <button
              type="button"
              onClick={onTogglePrivacy}
              className={`${BTN_OUTLINE} flex-shrink-0`}
            >
              Hacer {isPublic ? "privado" : "público"}
            </button>
          </div>
          {zones.length > 0 && (
            <div className="space-y-1.5 py-4">
              <label id="set-zone-label" htmlFor="set-zone" className={LABEL}>
                Mi zona
              </label>
              <SettingsSelect
                id="set-zone"
                value={zone}
                onChange={onZoneChange}
                placeholder="Selecciona tu zona"
                options={zones.map((z) => ({ value: z, label: z }))}
              />
              <p className={HINT}>El calendario se abre en esta zona.</p>
            </div>
          )}
          {isPlayer && stores.length > 0 && (
            <div className="space-y-1.5 py-4 last:pb-0">
              <label id="set-store-label" htmlFor="set-store" className={LABEL}>
                Mi tienda principal{" "}
                <span className="font-normal text-foreground-subtle">(opcional)</span>
              </label>
              <SettingsSelect
                id="set-store"
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
              <p className={HINT}>Se muestra en tu Inicio y en tu perfil.</p>
            </div>
          )}
        </div>
      </section>

      {/* TCG IDs — solo jugadores */}
      {isPlayer && (
        <section aria-labelledby="s-ids" className={SECTION}>
          <h2 id="s-ids" className={H2}>
            Mis IDs de TCG
          </h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            Una vez registrado un ID, no puede ser modificado. Si hay un error, contacta a un
            administrador.
          </p>

          {tcgIds.length > 0 && (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {tcgIds.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground-subtle">{t.game_name}</p>
                    <p className="truncate font-mono-stat text-base text-foreground">
                      {t.tcg_user_id}
                    </p>
                  </div>
                  <span className="flex-shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-foreground-secondary">
                    Solo lectura
                  </span>
                </li>
              ))}
            </ul>
          )}

          {availableGames.length > 0 ? (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Agregar un ID</h3>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-1.5">
                  <label id="set-id-game-label" htmlFor="set-id-game" className={LABEL}>
                    TCG
                  </label>
                  <SettingsSelect
                    id="set-id-game"
                    value={selectedGameId}
                    onChange={setSelectedGameId}
                    placeholder="Selecciona el TCG"
                    options={availableGames.map((g) => ({ value: g.id, label: g.name }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="set-id-value" className={LABEL}>
                    Tu ID de jugador
                  </label>
                  <input
                    id="set-id-value"
                    value={newTcgUserId}
                    onChange={(e) => setNewTcgUserId(e.target.value)}
                    autoComplete="off"
                    aria-describedby="set-id-hint"
                    className={`${INPUT} font-mono-stat`}
                  />
                </div>
                <button
                  type="button"
                  onClick={onAddTcgId}
                  disabled={savingTcgId || !selectedGameId || !newTcgUserId.trim()}
                  className={BTN_PRIMARY}
                >
                  {savingTcgId && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
                  {savingTcgId ? "Agregando…" : "Agregar ID"}
                </button>
              </div>
              <p id="set-id-hint" className="text-sm text-warning">
                Revisa el ID antes de agregarlo: después no se puede cambiar.
              </p>
            </div>
          ) : tcgIds.length > 0 ? (
            <p className={`mt-3 ${HINT}`}>
              Ya tienes IDs registrados para todos los TCG disponibles.
            </p>
          ) : null}
        </section>
      )}

      <PushNotificationsToggle />

      {/* Cuenta: email, contraseña y salida */}
      <section aria-labelledby="s-cuenta" className={SECTION}>
        <h2 id="s-cuenta" className={H2}>
          Cuenta
        </h2>
        <div className="mt-2 divide-y divide-border">
          <div className="py-4">
            <p className={LABEL}>Email</p>
            {currentEmail && <p className="mt-1 break-words text-foreground">{currentEmail}</p>}
            {/* ponytail: cambio de email apagado hasta tener SMTP propio; después va con
                nexus.auth.updateUser({ email }) aquí y se borra updateMyEmail. */}
            <p className={`mt-1 ${HINT}`}>Pronto podrás cambiar tu email desde aquí.</p>
          </div>

          <div className="space-y-4 py-4">
            <h3 className="text-sm font-semibold text-foreground">Cambiar contraseña</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="set-pass" className={LABEL}>
                  Nueva contraseña
                </label>
                <input
                  id="set-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className={INPUT}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="set-pass2" className={LABEL}>
                  Confirmar contraseña
                </label>
                <input
                  id="set-pass2"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                  aria-invalid={confirmMismatch}
                  aria-describedby="set-pass2-hint"
                  className={`${INPUT} ${confirmMismatch ? "border-destructive" : ""}`}
                />
                <p id="set-pass2-hint" aria-live="polite" className="text-xs">
                  {confirmMismatch ? (
                    <span className="text-destructive">Las contraseñas no coinciden</span>
                  ) : confirmPassword.length > 0 && newPassword.length >= 8 ? (
                    <span className="inline-flex items-center gap-1 text-foreground-secondary">
                      <Check size={14} aria-hidden="true" />
                      Las contraseñas coinciden
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <PasswordStrength password={newPassword} />

            <button
              type="button"
              onClick={onUpdatePassword}
              disabled={savingPassword || !passwordReady}
              className={BTN_PRIMARY}
            >
              {savingPassword && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
              {savingPassword ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <p className="text-sm text-foreground-secondary">
              Sal de tu cuenta en este dispositivo.
            </p>
            <ConfirmLogout
              onConfirm={async () => {
                await nexus.auth.signOut();
                window.location.href = "/login";
              }}
              trigger={
                <button type="button" className={BTN_OUTLINE}>
                  Cerrar sesión
                </button>
              }
            />
          </div>
        </div>
      </section>
    </>,
  );
}
