import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  listPlayers,
  setPlayerRole,
  listStoresWithOrganizers,
} from "@/lib/geekarena-admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/players")({
  component: AdminPlayersPage,
});

type P = {
  id: string;
  geek_tag: string;
  display_name: string | null;
  email: string | null;
  role: "player" | "organizer" | "admin";
  home_store_id: string | null;
};
type Store = { id: string; name: string };

function AdminPlayersPage() {
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;
  const fetchPlayers = useServerFn(listPlayers);
  const fetchStores = useServerFn(listStoresWithOrganizers);
  const setRole = useServerFn(setPlayerRole);

  const [players, setPlayers] = useState<P[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async (em: string, s = "") => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetchPlayers({ data: { email: em, search: s || undefined } }),
        fetchStores({ data: { email: em } }),
      ]);
      setPlayers(pRes.players as P[]);
      setStores(sRes.stores as Store[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    refresh(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const updateRole = async (p: P, role: P["role"]) => {
    if (!email) return;
    try {
      await setRole({ data: { email, player_id: p.id, role } });
      toast.success(`Rol actualizado: ${role}`);
      await refresh(email, search);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  const updateStore = async (p: P, store_id: string) => {
    if (!email) return;
    try {
      await setRole({
        data: {
          email,
          player_id: p.id,
          role: p.role,
          home_store_id: store_id || null,
        },
      });
      toast.success("Tienda asignada");
      await refresh(email, search);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Comunidad
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Jugadores</h1>
        <p className="mt-1 text-sm text-gray-400">
          Administra roles y tiendas asignadas.
        </p>
      </header>

      <div className="glass flex items-center gap-2 rounded-2xl p-3">
        <Search size={16} className="ml-2 text-gray-500" />
        <Input
          placeholder="Buscar por geek tag, nombre o email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => email && refresh(email, search)}
        >
          Buscar
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">Geek Tag</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Tienda</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white">
                      {p.geek_tag}
                      {p.display_name ? (
                        <span className="block text-xs text-gray-500">
                          {p.display_name}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={p.role}
                        onValueChange={(v) => updateRole(p, v as P["role"])}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="player">player</SelectItem>
                          <SelectItem value="organizer">organizer</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={p.home_store_id ?? "__none"}
                        onValueChange={(v) =>
                          updateStore(p, v === "__none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="h-8 w-56">
                          <SelectValue placeholder="Sin tienda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Sin tienda</SelectItem>
                          {stores.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
