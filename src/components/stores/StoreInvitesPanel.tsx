import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  approveStoreSignup,
  createStoreInvite,
  getStoreInviteLink,
  getStoreSignupPanel,
  rejectStoreSignup,
  revokeStoreInvite,
} from "@/lib/nexus-store-invites.functions";
import { deleteSubzone, deleteZone, saveSubzone, saveZone } from "@/lib/nexus-zones.functions";
import { safeHref } from "@/lib/utils";

type Panel = Awaited<ReturnType<typeof getStoreSignupPanel>>;
type SignupRequest = Panel["requests"][number];
type Zone = Panel["zones"][number];

const fieldClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const secondaryButton =
  "rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50";
const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50";

const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children || "—"}</dd>
    </div>
  );
}

function ReviewDialog({
  request,
  zones,
  onClose,
  onDone,
}: {
  request: SignupRequest | null;
  zones: Zone[];
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const approve = useServerFn(approveStoreSignup);
  const reject = useServerFn(rejectStoreSignup);
  const [zone, setZone] = useState("");
  const [subzone, setSubzone] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setZone(request?.zone ?? "");
    setSubzone(request?.subzone ?? "");
    setRejecting(false);
    setReason("");
  }, [request]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      onClose();
      await onDone();
    } catch (e) {
      toast.error(errorText(e, "No se pudo completar la acción"));
    } finally {
      setBusy(false);
    }
  };

  const subzoneOptions = zones.find((z) => z.name === zone)?.subzones ?? [];
  const subzoneReady =
    subzoneOptions.length === 0 || subzoneOptions.some((s) => s.name === subzone);

  const networks = request
    ? [
        request.instagram && `Instagram @${request.instagram}`,
        request.twitter && `X @${request.twitter}`,
        request.twitch && `Twitch ${request.twitch}`,
        request.website,
      ].filter(Boolean)
    : [];

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{request?.store_name}</DialogTitle>
        </DialogHeader>
        {request && (
          <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Ubicación">
                {request.city}, {request.state}
              </Detail>
              <Detail label="TCG">{request.games?.name}</Detail>
              <Detail label="Correo">{request.email}</Detail>
              <Detail label="Teléfono">{request.phone}</Detail>
              <div className="sm:col-span-2">
                <Detail label="Dirección">{request.address}</Detail>
              </div>
              <div className="sm:col-span-2">
                <Detail label="Horario">{request.opening_hours}</Detail>
              </div>
              <div className="sm:col-span-2">
                <Detail label="Redes">{networks.join(" · ")}</Detail>
              </div>
              {safeHref(request.google_maps_url) && (
                <a
                  href={safeHref(request.google_maps_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  Ver en Google Maps
                </a>
              )}
            </dl>

            <div className="space-y-1.5 border-t border-border pt-4">
              <label htmlFor="review-zone" className="text-sm font-medium text-foreground">
                Zona
              </label>
              {!request.zone && (
                <p className="text-xs text-amber-400">
                  La tienda marcó «No sé»: contáctala para definir su zona.
                </p>
              )}
              <select
                id="review-zone"
                value={zone}
                onChange={(e) => {
                  setZone(e.target.value);
                  setSubzone("");
                }}
                className={fieldClass}
              >
                <option value="">Elige la zona</option>
                {zones.map((z) => (
                  <option key={z.name} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            {subzoneOptions.length > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="review-subzone" className="text-sm font-medium text-foreground">
                  Subzona
                </label>
                {!request.subzone && zone === request.zone && (
                  <p className="text-xs text-amber-400">
                    La tienda marcó «No sé»: contáctala para definir su subzona.
                  </p>
                )}
                <select
                  id="review-subzone"
                  value={subzone}
                  onChange={(e) => setSubzone(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Elige la subzona</option>
                  {subzoneOptions.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {rejecting ? (
              <div className="space-y-2">
                <input
                  aria-label="Motivo del rechazo"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo del rechazo"
                  className={fieldClass}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(false)}
                    className={secondaryButton}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={busy || reason.trim().length < 3}
                    onClick={() =>
                      run(
                        () => reject({ data: { request_id: request.id, reason } }),
                        "Solicitud rechazada",
                      )
                    }
                    className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Confirmar rechazo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejecting(true)}
                  className={secondaryButton}
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  disabled={busy || !zone || !subzoneReady}
                  onClick={() =>
                    run(
                      () =>
                        approve({
                          data: {
                            request_id: request.id,
                            zone,
                            subzone: subzoneOptions.length > 0 ? subzone : null,
                          },
                        }),
                      "Tienda aprobada. Agrégale sus torneos con el botón Torneos.",
                    )
                  }
                  className={primaryButton}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Aprobar
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RequestsTab({ panel, onDone }: { panel: Panel; onDone: () => Promise<unknown> }) {
  const [reviewing, setReviewing] = useState<SignupRequest | null>(null);

  if (panel.requests.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
        No hay solicitudes por revisar.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {panel.requests.map((r) => (
        <div
          key={r.id}
          className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{r.store_name}</p>
            <p className="text-xs text-muted-foreground">
              {r.city}, {r.state} · {r.games?.name ?? "TCG"} ·{" "}
              {r.zone ? (
                `${r.zone}${r.subzone ? ` · ${r.subzone}` : ""}`
              ) : (
                <span className="text-amber-400">Zona por definir</span>
              )}
            </p>
          </div>
          <button type="button" onClick={() => setReviewing(r)} className={primaryButton}>
            Revisar
          </button>
        </div>
      ))}
      <ReviewDialog
        request={reviewing}
        zones={panel.zones}
        onClose={() => setReviewing(null)}
        onDone={onDone}
      />
    </div>
  );
}

// `parent` indica que es una subzona de esa zona.
type ZoneDraft = { parent?: string; original?: string; name: string; description: string };

function ZonesSection({ zones, onChanged }: { zones: Zone[]; onChanged: () => Promise<unknown> }) {
  const save = useServerFn(saveZone);
  const remove = useServerFn(deleteZone);
  const [draft, setDraft] = useState<ZoneDraft | null>(null);
  const saveSub = useServerFn(saveSubzone);
  const removeSub = useServerFn(deleteSubzone);
  const [deleting, setDeleting] = useState<{ parent?: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      setDraft(null);
      await onChanged();
    } catch (e) {
      toast.error(errorText(e, "No se pudo guardar la zona"));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  return (
    <section className="glass space-y-3 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Zonas</h2>
          <p className="text-xs text-muted-foreground">
            La nota es lo que lee cada tienda para saber cuál elegir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ name: "", description: "" })}
          className={`${secondaryButton} inline-flex flex-shrink-0 items-center gap-1`}
        >
          <Plus size={12} /> Nueva zona
        </button>
      </div>

      <div className="divide-y divide-border">
        {zones.map((z) => (
          <div key={z.name} className="py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{z.name}</p>
                <p className="text-xs text-muted-foreground">{z.description || "Sin nota"}</p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ parent: z.name, name: "", description: "" })}
                  className={`${secondaryButton} inline-flex items-center gap-1`}
                >
                  <Plus size={12} /> Subzona
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ original: z.name, name: z.name, description: z.description })
                  }
                  className={secondaryButton}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting({ name: z.name })}
                  className={secondaryButton}
                >
                  Borrar
                </button>
              </div>
            </div>
            {z.subzones.length > 0 && (
              <div className="mt-2 space-y-1 border-l border-border pl-3">
                {z.subzones.map((sub) => (
                  <div key={sub.name} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{sub.name}</p>
                      {sub.description && (
                        <p className="text-xs text-muted-foreground">{sub.description}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            parent: z.name,
                            original: sub.name,
                            name: sub.name,
                            description: sub.description,
                          })
                        }
                        className={secondaryButton}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting({ parent: z.name, name: sub.name })}
                        className={secondaryButton}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft?.original ? "Editar" : "Nueva"} {draft?.parent ? "subzona" : "zona"}
              {draft?.parent ? ` de ${draft.parent}` : ""}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <input
                aria-label="Nombre de la zona"
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={
                  draft.parent ? "Nombre, por ejemplo Norte" : "Nombre, por ejemplo Zona Puebla"
                }
                className={fieldClass}
              />
              <input
                aria-label="Nota de la zona"
                value={draft.description}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Quién va aquí, para que cada tienda sepa si le toca"
                className={fieldClass}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDraft(null)} className={secondaryButton}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || draft.name.trim().length < 2}
                  onClick={() => {
                    const { parent, ...fields } = draft;
                    run(
                      () =>
                        parent
                          ? saveSub({ data: { zone: parent, ...fields } })
                          : save({ data: fields }),
                      parent ? "Subzona guardada" : "Zona guardada",
                    );
                  }}
                  className={primaryButton}
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de aparecer al registrar tiendas. Si tiene tiendas no se podrá borrar hasta
              moverlas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() =>
                deleting &&
                run(
                  () =>
                    deleting.parent
                      ? removeSub({ data: { zone: deleting.parent, name: deleting.name } })
                      : remove({ data: { name: deleting.name } }),
                  "Borrado",
                )
              }
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function InvitesSection({ panel, onChanged }: { panel: Panel; onChanged: () => Promise<unknown> }) {
  const revokeInvite = useServerFn(revokeStoreInvite);
  const fetchLink = useServerFn(getStoreInviteLink);
  const [busyId, setBusyId] = useState<string | null>(null);

  const copy = async (id: string) => {
    setBusyId(id);
    try {
      const { token } = await fetchLink({ data: { invite_id: id } });
      const url = `${window.location.origin}/registro-tienda/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("URL copiada");
      } catch {
        // Safari puede negar el portapapeles después de una llamada al servidor.
        window.prompt("Copia la URL:", url);
      }
    } catch (e) {
      toast.error(errorText(e, "No se pudo copiar la URL"));
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeInvite({ data: { invite_id: id } });
      toast.success("Enlace revocado");
      await onChanged();
    } catch (e) {
      toast.error(errorText(e, "No se pudo revocar el enlace"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="glass space-y-3 rounded-2xl p-5">
      <h2 className="text-base font-semibold text-foreground">Enlaces activos</h2>
      {panel.invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay enlaces activos.</p>
      ) : (
        <div className="divide-y divide-border">
          {panel.invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{i.email}</p>
                <p className="text-xs text-muted-foreground">
                  {i.games?.name ?? "TCG"} · vence{" "}
                  {new Date(i.expires_at).toLocaleDateString("es-MX")}
                  {!i.can_copy && " · URL no recuperable"}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                {i.can_copy && (
                  <button
                    type="button"
                    disabled={busyId === i.id}
                    onClick={() => copy(i.id)}
                    className={`${secondaryButton} inline-flex items-center gap-1`}
                  >
                    <Copy size={12} /> Copiar URL
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === i.id}
                  onClick={() => revoke(i.id)}
                  className={secondaryButton}
                >
                  Revocar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InviteDialog({
  open,
  games,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  games: Panel["games"];
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const createInvite = useServerFn(createStoreInvite);
  const [email, setEmail] = useState("");
  const [gameId, setGameId] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [canCopyLater, setCanCopyLater] = useState(true);
  const [creating, setCreating] = useState(false);
  const selectedGame = gameId || games[0]?.id || "";

  useEffect(() => {
    if (open) {
      setEmail("");
      setLink(null);
    }
  }, [open]);

  const create = async () => {
    setCreating(true);
    try {
      const { token, can_copy_later } = await createInvite({
        data: { email: email.trim(), game_id: selectedGame },
      });
      setCanCopyLater(can_copy_later);
      setLink(`${window.location.origin}/registro-tienda/${token}`);
      await onCreated();
    } catch (e) {
      toast.error(errorText(e, "No se pudo crear el enlace"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar tienda</DialogTitle>
        </DialogHeader>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copia el enlace y pásalo directo a {email.trim()}. Sirve una sola vez y vence en 7
              días.
            </p>
            {!canCopyLater && (
              <p role="alert" className="text-sm font-medium text-amber-400">
                Guarda este enlace ahora: no se podrá volver a copiar porque falta configurar
                STORE_INVITE_TOKEN_KEY en el servidor.
              </p>
            )}
            <code className="block break-all rounded-md border border-border bg-card p-3 text-xs text-foreground">
              {link}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("Enlace copiado");
              }}
              className={`${primaryButton} w-full`}
            >
              <Copy size={12} /> Copiar enlace
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Revisa bien el correo: la tienda entrará con él.
            </p>
            <input
              type="email"
              aria-label="Correo de la tienda"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo de la tienda"
              className={fieldClass}
            />
            <select
              aria-label="TCG de la tienda"
              value={selectedGame}
              onChange={(e) => setGameId(e.target.value)}
              className={fieldClass}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={creating || !selectedGame || !/^\S+@\S+\.\S+$/.test(email.trim())}
              onClick={create}
              className={`${primaryButton} w-full`}
            >
              {creating ? "Generando…" : "Generar enlace"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pestañas de la página de tiendas. "stores" y `extraTabs` los pinta la página; el resto, aquí. */
export function StoreAdminTabs({
  active,
  onChange,
  extraTabs = [],
  onApproved,
}: {
  active: string;
  onChange: (tab: string) => void;
  extraTabs?: { id: string; label: string }[];
  onApproved?: () => void;
}) {
  const fetchPanel = useServerFn(getStoreSignupPanel);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [inviting, setInviting] = useState(false);

  const refresh = () =>
    fetchPanel()
      .then(setPanel)
      .catch(() => toast.error("No se pudieron cargar las invitaciones"));

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = panel?.requests.length ?? 0;
  const tabs = [
    { id: "stores", label: "Tiendas" },
    { id: "requests", label: "Solicitudes" },
    { id: "registry", label: "Zonas e invitaciones" },
    ...extraTabs,
  ];

  const afterReview = async () => {
    await refresh();
    onApproved?.();
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10">
        <div role="tablist" className="flex flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              onClick={() => onChange(tab.id)}
              className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                active === tab.id
                  ? "border-primary text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
              {tab.id === "requests" && pendingCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-black">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!panel}
          onClick={() => setInviting(true)}
          className={`${primaryButton} mb-2`}
        >
          <UserPlus size={14} /> Invitar tienda
        </button>
      </div>

      {panel && active === "requests" && <RequestsTab panel={panel} onDone={afterReview} />}
      {panel && active === "registry" && (
        <div className="space-y-6">
          <ZonesSection zones={panel.zones} onChanged={refresh} />
          <InvitesSection panel={panel} onChanged={refresh} />
        </div>
      )}

      <InviteDialog
        open={inviting}
        games={panel?.games ?? []}
        onOpenChange={setInviting}
        onCreated={refresh}
      />
    </>
  );
}
