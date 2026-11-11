import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, History, Inbox, Loader2, Send, UserPlus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ago } from "@/components/panel/dashboard-format";
import { refreshBadges } from "@/hooks/use-badge-counts";
import {
  approveStoreSignup,
  createStoreInvite,
  getStoreInviteLink,
  getStoreSignupPanel,
  rejectStoreSignup,
  revokeStoreInvite,
} from "@/lib/nexus-store-invites.functions";
import { AFFILIATION_PLAN_LABELS, type AffiliationPlan } from "@/lib/store-invite-rules";
import { safeHref } from "@/lib/utils";

type Panel = Awaited<ReturnType<typeof getStoreSignupPanel>>;
type SignupRequest = Panel["requests"][number];
type Invite = Panel["invites"][number];
type Zone = Panel["zones"][number];
type HistoryItem = Panel["history"][number];

const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

const OUTCOMES: Record<HistoryItem["outcome"], { label: string; className: string }> = {
  approved: { label: "Aprobada", className: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "Rechazada", className: "bg-red-500/15 text-red-400" },
  revoked: { label: "Invitación revocada", className: "bg-white/10 text-muted-foreground" },
  expired: { label: "Invitación vencida", className: "bg-white/10 text-muted-foreground" },
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children || "—"}</dd>
    </div>
  );
}

// Jerarquía: el encabezado de sección va en su propia franja y más grande que cualquier fila,
// para que nunca se confunda con el contenido.
function SectionCard({
  title,
  description,
  count,
  urgent = false,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  urgent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <header className="border-b border-white/10 bg-white/[0.03] px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {count !== undefined && count > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                urgent ? "bg-amber-400 text-black" : "bg-white/10 text-foreground"
              }`}
            >
              {count}
            </span>
          )}
        </div>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="px-5 py-1">{children}</div>
    </section>
  );
}

// Filas en columnas: qué es · cuándo · acción. Igual en las tres secciones.
const rowClass = "grid items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]";
const whenClass = "text-xs text-muted-foreground sm:text-right";

function ReviewSheet({
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
    <Sheet open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{request?.store_name}</SheetTitle>
          <SheetDescription>
            Revisa los datos, asigna la zona y aprueba. Al aprobar, la tienda podrá entrar con su
            correo.
          </SheetDescription>
        </SheetHeader>
        {request && (
          <div className="mt-6 space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Ubicación">
                {request.city}, {request.state}
              </Detail>
              <Detail label="TCG">{request.games?.name}</Detail>
              <Detail label="Correo">{request.email}</Detail>
              <Detail label="Teléfono de la tienda">{request.phone}</Detail>
              <Detail label="Encargado">{request.manager_name}</Detail>
              <Detail label="WhatsApp del encargado">{request.manager_phone}</Detail>
              <Detail label="Plan de afiliación">
                {request.affiliation_plan &&
                  AFFILIATION_PLAN_LABELS[request.affiliation_plan as AffiliationPlan]}
              </Detail>
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
              <Label htmlFor="review-zone">Zona</Label>
              {!request.zone && (
                <p className="text-xs text-amber-400">
                  La tienda marcó «No sé»: contáctala para definir su zona.
                </p>
              )}
              <Select
                value={zone}
                onValueChange={(next) => {
                  setZone(next);
                  setSubzone("");
                }}
              >
                <SelectTrigger id="review-zone">
                  <SelectValue placeholder="Elige la zona" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.name} value={z.name}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subzoneOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="review-subzone">Subzona</Label>
                {!request.subzone && zone === request.zone && (
                  <p className="text-xs text-amber-400">
                    La tienda marcó «No sé»: contáctala para definir su subzona.
                  </p>
                )}
                <Select value={subzone} onValueChange={setSubzone}>
                  <SelectTrigger id="review-subzone">
                    <SelectValue placeholder="Elige la subzona" />
                  </SelectTrigger>
                  <SelectContent>
                    {subzoneOptions.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {rejecting ? (
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Motivo del rechazo</Label>
                <Input
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRejecting(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy || reason.trim().length < 3}
                    onClick={() =>
                      run(
                        () => reject({ data: { request_id: request.id, reason } }),
                        "Solicitud rechazada",
                      )
                    }
                  >
                    Confirmar rechazo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRejecting(true)}>
                  Rechazar
                </Button>
                <Button
                  size="sm"
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
                      "Tienda aprobada. Agrégale sus torneos desde Tiendas.",
                    )
                  }
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Aprobar
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InvitesSection({
  invites,
  onInvite,
  onChanged,
}: {
  invites: Invite[];
  onInvite: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const revokeInvite = useServerFn(revokeStoreInvite);
  const fetchLink = useServerFn(getStoreInviteLink);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Invite | null>(null);

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

  const revoke = async (invite: Invite) => {
    setBusyId(invite.id);
    try {
      await revokeInvite({ data: { invite_id: invite.id } });
      toast.success("Invitación revocada");
      await onChanged();
    } catch (e) {
      toast.error(errorText(e, "No se pudo revocar la invitación"));
    } finally {
      setBusyId(null);
      setRevoking(null);
    }
  };

  return (
    <SectionCard
      title="Invitaciones enviadas"
      count={invites.length}
      description="Esperando a que la tienda llene su registro. Cada enlace sirve una vez y vence en 7 días."
    >
      {invites.length === 0 ? (
        <EmptyState
          icon={<Send size={20} />}
          title="No hay invitaciones pendientes"
          description="Invita a una tienda y pásale el enlace para que se registre."
          action={
            <Button size="sm" variant="outline" onClick={onInvite}>
              <UserPlus size={14} /> Invitar tienda
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border">
          {invites.map((i) => (
            <div key={i.id} className={rowClass}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{i.email}</p>
                <p className="text-xs text-muted-foreground">
                  {i.games?.name ?? "TCG"}
                  {!i.can_copy && " · URL no recuperable"}
                </p>
              </div>
              <p className={whenClass}>
                Vence {new Date(i.expires_at).toLocaleDateString("es-MX")}
              </p>
              <div className="flex flex-shrink-0 justify-end gap-2">
                {i.can_copy && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === i.id}
                    onClick={() => copy(i.id)}
                  >
                    <Copy size={12} /> Copiar URL
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === i.id}
                  onClick={() => setRevoking(i)}
                >
                  Revocar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(revoking)} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar la invitación a {revoking?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace dejará de funcionar. Si la tienda aún quiere entrar, tendrás que mandarle
              una invitación nueva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(busyId)}
              onClick={() => revoking && revoke(revoking)}
            >
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}

function HistorySection({ items }: { items: HistoryItem[] }) {
  const now = new Date();
  return (
    <SectionCard
      title="Historial"
      description="Lo que se resolvió en los últimos 30 días: solicitudes revisadas e invitaciones que no se usaron."
    >
      {items.length === 0 ? (
        <EmptyState icon={<History size={20} />} title="Sin movimientos en los últimos 30 días" />
      ) : (
        <div className="divide-y divide-border">
          {items.map((h) => (
            <div key={h.id} className={rowClass}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{h.title}</p>
                <p className="text-xs text-muted-foreground">{h.detail}</p>
                {h.note && <p className="text-xs text-muted-foreground">Motivo: {h.note}</p>}
              </div>
              <p className={whenClass}>{ago(h.at, now)}</p>
              <div className="flex justify-end">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${OUTCOMES[h.outcome].className}`}
                >
                  {OUTCOMES[h.outcome].label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
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
              días. Lo verás en «Invitaciones enviadas» hasta que la tienda se registre.
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
            <Button
              className="w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("Enlace copiado");
              }}
            >
              <Copy size={14} /> Copiar enlace
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Correo de la tienda</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tienda@correo.com"
              />
              <p className="text-xs text-muted-foreground">
                Revísalo bien: la tienda entrará con este correo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-game">TCG</Label>
              <Select value={selectedGame} onValueChange={setGameId}>
                <SelectTrigger id="invite-game">
                  <SelectValue placeholder="Elige el TCG" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={creating || !selectedGame || !/^\S+@\S+\.\S+$/.test(email.trim())}
              onClick={create}
            >
              {creating ? "Generando…" : "Generar enlace"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Página de altas: todo el camino de una tienda nueva, de la invitación a la aprobación. */
export function StoreAltasPanel() {
  const fetchPanel = useServerFn(getStoreSignupPanel);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [failed, setFailed] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [reviewing, setReviewing] = useState<SignupRequest | null>(null);

  const refresh = () =>
    fetchPanel()
      .then((data) => {
        setPanel(data);
        setFailed(false);
      })
      .catch(() => setFailed(true));

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invite = () => setInviting(true);
  const now = new Date();

  let body: React.ReactNode;
  if (panel) {
    body = (
      <div className="space-y-6">
        <SectionCard
          title="Por revisar"
          count={panel.requests.length}
          urgent
          description="Tiendas que ya llenaron su registro. Revisa sus datos, asigna zona y aprueba."
        >
          {panel.requests.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="No hay solicitudes por revisar"
              description="Cuando una tienda invitada llene su registro, aparecerá aquí."
            />
          ) : (
            <div className="divide-y divide-border">
              {panel.requests.map((r) => (
                <div key={r.id} className={rowClass}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{r.store_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.city}, {r.state} · {r.games?.name ?? "TCG"} ·{" "}
                      {r.zone ? (
                        `${r.zone}${r.subzone ? ` · ${r.subzone}` : ""}`
                      ) : (
                        <span className="text-amber-400">Zona por definir</span>
                      )}
                    </p>
                  </div>
                  <p className={whenClass}>Llegó {ago(r.created_at, now)}</p>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setReviewing(r)}>
                      Revisar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <InvitesSection invites={panel.invites} onInvite={invite} onChanged={refresh} />
        <HistorySection items={panel.history} />

        <ReviewSheet
          request={reviewing}
          zones={panel.zones}
          onClose={() => setReviewing(null)}
          onDone={async () => {
            await refresh();
            refreshBadges();
          }}
        />
      </div>
    );
  } else if (failed) {
    body = (
      <div className="glass rounded-2xl">
        <EmptyState
          title="No se pudo cargar"
          description="Revisa tu conexión e intenta de nuevo."
          action={
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  } else {
    body = (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Red"
        title="Altas de tiendas"
        description="Invita tiendas, revisa su registro y apruébalas."
        actions={
          <Button onClick={invite} disabled={!panel}>
            <UserPlus size={14} /> Invitar tienda
          </Button>
        }
      />
      {body}
      <InviteDialog
        open={inviting}
        games={panel?.games ?? []}
        onOpenChange={setInviting}
        onCreated={refresh}
      />
    </div>
  );
}
