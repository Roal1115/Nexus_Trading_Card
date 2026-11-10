import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Map as MapIcon, MoreHorizontal, Plus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
  deleteSubzone,
  deleteZone,
  listZones,
  saveSubzone,
  saveZone,
} from "@/lib/nexus-zones.functions";

type Zone = Awaited<ReturnType<typeof listZones>>["zones"][number];
// `parent` indica que es una subzona de esa zona.
type ZoneDraft = { parent?: string; original?: string; name: string; description: string };
type Target = { parent?: string; name: string; stores: number };

const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

const storesLabel = (n: number) => (n === 1 ? "1 tienda" : `${n} tiendas`);

function ItemMenu({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 flex-shrink-0"
          aria-label={`Opciones de ${label}`}
        >
          <MoreHorizontal size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-red-400 focus:text-red-400">
          Borrar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ZoneCard({
  zone,
  onDraft,
  onDelete,
}: {
  zone: Zone;
  onDraft: (draft: ZoneDraft) => void;
  onDelete: (target: Target) => void;
}) {
  return (
    <article className="glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold text-foreground">{zone.name}</h2>
          <span className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {storesLabel(zone.store_count)}
          </span>
        </div>
        <ItemMenu
          label={zone.name}
          onEdit={() =>
            onDraft({ original: zone.name, name: zone.name, description: zone.description })
          }
          onDelete={() => onDelete({ name: zone.name, stores: zone.store_count })}
        />
      </div>

      <p
        title={zone.description || undefined}
        className="line-clamp-3 text-xs text-muted-foreground"
      >
        {zone.description || "Sin nota para las tiendas."}
      </p>

      <div className="mt-auto space-y-1 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Subzonas
        </p>
        {zone.subzones.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin subzonas.</p>
        ) : (
          zone.subzones.map((sub) => (
            <div key={sub.name} className="flex items-center justify-between gap-2 py-1">
              <div className="min-w-0">
                <p className="break-words text-sm text-foreground">
                  {sub.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {storesLabel(sub.store_count)}
                  </span>
                </p>
                {sub.description && (
                  <p title={sub.description} className="line-clamp-2 text-xs text-muted-foreground">
                    {sub.description}
                  </p>
                )}
              </div>
              <ItemMenu
                label={sub.name}
                onEdit={() =>
                  onDraft({
                    parent: zone.name,
                    original: sub.name,
                    name: sub.name,
                    description: sub.description,
                  })
                }
                onDelete={() =>
                  onDelete({ parent: zone.name, name: sub.name, stores: sub.store_count })
                }
              />
            </div>
          ))
        )}
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2 text-primary"
          onClick={() => onDraft({ parent: zone.name, name: "", description: "" })}
        >
          <Plus size={14} /> Agregar subzona
        </Button>
      </div>
    </article>
  );
}

/** Página de zonas: configuración que cambia poco, separada del flujo de altas. */
export function StoreZonesPanel() {
  const fetchZones = useServerFn(listZones);
  const save = useServerFn(saveZone);
  const remove = useServerFn(deleteZone);
  const saveSub = useServerFn(saveSubzone);
  const removeSub = useServerFn(deleteSubzone);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<ZoneDraft | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    fetchZones()
      .then((res) => {
        setZones(res.zones);
        setFailed(false);
      })
      .catch(() => setFailed(true));

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      setDraft(null);
      await refresh();
    } catch (e) {
      toast.error(errorText(e, "No se pudo guardar la zona"));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const newZone = () => setDraft({ name: "", description: "" });

  let body: React.ReactNode;
  if (zones && zones.length > 0) {
    body = (
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => (
          <ZoneCard key={z.name} zone={z} onDraft={setDraft} onDelete={setDeleting} />
        ))}
      </div>
    );
  } else if (zones) {
    body = (
      <div className="glass rounded-2xl">
        <EmptyState
          icon={<MapIcon size={20} />}
          title="Aún no hay zonas"
          description="Crea la primera para que las tiendas puedan elegirla al registrarse."
          action={
            <Button size="sm" onClick={newZone}>
              <Plus size={14} /> Nueva zona
            </Button>
          }
        />
      </div>
    );
  } else if (failed) {
    body = (
      <div className="glass rounded-2xl">
        <EmptyState
          title="No se pudieron cargar las zonas"
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
        eyebrow="Configuración"
        title="Zonas"
        description="Agrupan a las tiendas por región. La nota es lo que lee cada tienda al registrarse para saber cuál elegir."
        actions={
          <Button onClick={newZone}>
            <Plus size={14} /> Nueva zona
          </Button>
        }
      />
      {body}

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
              <div className="space-y-1.5">
                <Label htmlFor="zone-name">Nombre</Label>
                <Input
                  id="zone-name"
                  value={draft.name}
                  maxLength={60}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={draft.parent ? "Por ejemplo, Norte" : "Por ejemplo, Zona Puebla"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-note">Nota para las tiendas</Label>
                <Input
                  id="zone-note"
                  value={draft.description}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Quién va aquí, para que cada tienda sepa si le toca"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
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
                >
                  Guardar
                </Button>
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
              {deleting && deleting.stores > 0
                ? `Tiene ${storesLabel(deleting.stores)}. Muévelas a otra zona antes de borrarla.`
                : "Dejará de aparecer al registrar tiendas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || (deleting?.stores ?? 0) > 0}
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
    </div>
  );
}
