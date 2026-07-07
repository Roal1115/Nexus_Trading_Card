import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Calendar, Loader2, Plus, Play, X } from "lucide-react";
import { toast } from "sonner";
import { TournamentRowSkeleton } from "@/components/ui/skeleton-loader";
import {
  listSeasons,
  createSeason,
  activateSeason,
  closeSeason,
} from "@/lib/nexus-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/seasons")({
  component: AdminSeasonsPage,
});

type Season = {
  id: string;
  name: string;
  slug: string;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
  status: "UPCOMING" | "ACTIVE" | "CLOSED";
  created_at: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function statusVariant(status: Season["status"]) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "UPCOMING":
      return "bg-white/10 text-gray-300 border-white/20";
    case "CLOSED":
      return "bg-red-500/20 text-red-300 border-red-500/30";
  }
}

function statusLabel(status: Season["status"]) {
  return status === "ACTIVE"
    ? "Activa"
    : status === "UPCOMING"
      ? "Próxima"
      : "Cerrada";
}

function AdminSeasonsPage() {
  const fetchList = useServerFn(listSeasons);
  const createFn = useServerFn(createSeason);
  const activateFn = useServerFn(activateSeason);
  const closeFn = useServerFn(closeSeason);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchList();
      setSeasons(data as Season[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setStartDate("");
    setEndDate("");
  }

  async function handleCreate() {
    if (!name || !slug || !startDate || !endDate) {
      toast.error("Completa todos los campos.");
      return;
    }
    setSubmitting(true);
    try {
      await createFn({
        data: { name, slug, start_date: startDate, end_date: endDate },
      });
      toast.success("Temporada creada.");
      setOpen(false);
      resetForm();
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(id: string) {
    try {
      await activateFn({ data: { season_id: id } });
      toast.success("Temporada activada.");
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  }

  async function handleClose(id: string) {
    if (!confirm("¿Cerrar esta temporada? Ya no se podrán publicar torneos en ella.")) return;
    try {
      await closeFn({ data: { season_id: id } });
      toast.success("Temporada cerrada.");
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Temporadas
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Gestión de Temporadas
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Define los rangos de fechas que agrupan los torneos del circuito.
            Solo puede haber una temporada activa a la vez.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} />
              Nueva temporada
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva temporada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="season-name">Nombre</Label>
                <Input
                  id="season-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  placeholder="TCG México Season 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="season-slug">Slug</Label>
                <Input
                  id="season-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="tcg-mexico-s2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="season-start">Fecha inicio</Label>
                  <Input
                    id="season-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="season-end">Fecha fin</Label>
                  <Input
                    id="season-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  "Crear"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TournamentRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : seasons.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          No hay temporadas creadas. Crea la primera para empezar.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-primary" />
                        {s.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {s.slug}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{s.start_date}</td>
                    <td className="px-4 py-3 text-gray-300">{s.end_date}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={statusVariant(s.status)}
                      >
                        {statusLabel(s.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {s.status === "UPCOMING" && (
                          <button
                            onClick={() => handleActivate(s.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
                          >
                            <Play size={12} />
                            Activar
                          </button>
                        )}
                        {(s.status === "ACTIVE" || s.status === "UPCOMING") && (
                          <button
                            onClick={() => handleClose(s.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                          >
                            <X size={12} />
                            Cerrar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
