import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getOrganizerOverview,
  createTournament,
} from "@/lib/geekarena-organizer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/organizer/new")({
  component: NewTournamentPage,
});

type Game = { id: string; name: string };

function NewTournamentPage() {
  const navigate = useNavigate();
  const { player, loading: roleLoading } = useGeekarenaRole();
  const email = player?.email ?? null;

  const fetchOverview = useServerFn(getOrganizerOverview);
  const submit = useServerFn(createTournament);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [hasStore, setHasStore] = useState(false);

  const [gameId, setGameId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [csvUrl, setCsvUrl] = useState<string>("");

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res = await fetchOverview({ data: { email } });
        setGames(res.games as Game[]);
        setHasStore(Boolean(res.homeStore));
        setStoreName(res.homeStore?.name ?? null);
      } catch (e) {
        toast.error(String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const qualifying = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    const m = d.getMonth() + 1;
    return {
      month: m,
      semester: m <= 6 ? 1 : 2,
      year: d.getFullYear(),
    };
  }, [date]);

  const handleSubmit = async () => {
    if (!email) return;
    if (!gameId) return toast.error("Selecciona un juego (TCG)");
    if (!date) return toast.error("Selecciona una fecha");
    if (csvUrl && !/^https?:\/\//i.test(csvUrl))
      return toast.error("La URL del CSV debe iniciar con http(s)://");

    setSaving(true);
    try {
      await submit({
        data: {
          email,
          game_id: gameId,
          tournament_date: date,
          csv_url: csvUrl || null,
        },
      });
      toast.success("Torneo creado como borrador");
      navigate({ to: "/organizer/tournaments" });
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!hasStore) {
    return (
      <div className="glass rounded-2xl p-8 text-sm text-gray-300">
        Primero debes asignar una tienda en{" "}
        <a href="/organizer" className="text-primary underline">
          Mi Tienda
        </a>
        .
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Subir Torneo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Registrar nuevo torneo
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Tienda: <span className="text-white">{storeName}</span> · Se creará
          como Borrador hasta que un administrador lo apruebe.
        </p>
      </header>

      <section className="glass space-y-5 rounded-2xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">TCG (juego)</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un TCG" />
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
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Fecha del torneo</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-gray-400">
            URL del CSV de resultados (opcional)
          </Label>
          <Input
            placeholder="https://..."
            value={csvUrl}
            onChange={(e) => setCsvUrl(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Sube el archivo a tu almacenamiento y pega aquí el enlace. Más
            adelante podrás cargarlo directamente.
          </p>
        </div>

        {qualifying && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
            Calificación calculada: mes <strong className="text-white">{qualifying.month}</strong>{" "}
            · semestre{" "}
            <strong className="text-white">{qualifying.semester}</strong> ·
            año <strong className="text-white">{qualifying.year}</strong>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/organizer/tournaments" })}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            <Upload size={14} className="mr-1" />
            {saving ? "Guardando..." : "Crear borrador"}
          </Button>
        </div>
      </section>
    </div>
  );
}
