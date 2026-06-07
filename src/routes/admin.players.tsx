import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  listPlayers,
  setPlayerRole,
  setPlayerActive,
  listStoresWithOrganizers,
  getPlayerDetail,
  updatePlayerDetail,
} from "@/lib/geekarena-admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/admin/players")({
  component: AdminPlayersPage,
});

type Role = "player" | "organizer" | "tcg_manager" | "admin";
type P = {
  id: string;
  geek_tag: string;
  display_name: string | null;
  email: string | null;
  role: Role;
  home_store_id: string | null;
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string | null;
  manager_games?: { game_id: string; games: { name: string } | null }[] | null;
};
type Store = { id: string; name: string; city: string | null };

type Tab = "all" | "organizers" | "managers" | "admins";

const PAGE_SIZE = 25;

function AdminPlayersPage() {
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;

  const fetchPlayers = useServerFn(listPlayers);
  const fetchStores = useServerFn(listStoresWithOrganizers);
  const setRole = useServerFn(setPlayerRole);
  const setActive = useServerFn(setPlayerActive);

  const [tab, setTab] = useState<Tab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "geek_tag" | "points">("recent");
  const [page, setPage] = useState(1);

  const [players, setPlayers] = useState<P[]>([]);
  const [total, setTotal] = useState(0);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // modals
  const [roleModal, setRoleModal] = useState<{ p: P; next: Role } | null>(null);
  const [storeModal, setStoreModal] = useState<{ p: P; next: string } | null>(null);
  const [activeModal, setActiveModal] = useState<P | null>(null);
  const [acting, setActing] = useState(false);

  // detail modal
  type DetailData = Awaited<ReturnType<typeof getPlayerDetail>>;
  type EditFields = {
    display_name: string;
    gender: string;
    birth_date: string;
    is_profile_public: boolean;
    tcg_ids: Array<{ game_id: string; tcg_user_id: string }>;
  };
  const [detailModal, setDetailModal] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
    display_name: "",
    gender: "",
    birth_date: "",
    is_profile_public: true,
    tcg_ids: [],
  });
  const [savingDetail, setSavingDetail] = useState(false);
  const fetchDetail = useServerFn(getPlayerDetail);
  const updateDetail = useServerFn(updatePlayerDetail);

  const openDetail = async (playerId: string) => {
    setDetailModal(playerId);
    setDetailLoading(true);
    setEditMode(false);
    setDetailData(null);
    try {
      const d = await fetchDetail({ data: { player_id: playerId } });
      setDetailData(d);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailModal(null);
    setDetailData(null);
    setEditMode(false);
  };

  const enterEditMode = () => {
    if (!detailData) return;
    const p: any = detailData.player;
    setEditFields({
      display_name: p.display_name ?? "",
      gender: p.gender ?? "",
      birth_date: p.birth_date ?? "",
      is_profile_public: p.is_profile_public ?? true,
      tcg_ids: (detailData.tcg_ids ?? []).map((t) => ({
        game_id: t.game_id,
        tcg_user_id: t.tcg_user_id,
      })),
    });
    setEditMode(true);
  };

  const saveDetail = async () => {
    if (!detailModal) return;
    setSavingDetail(true);
    try {
      await updateDetail({
        data: {
          player_id: detailModal,
          display_name: editFields.display_name,
          gender: editFields.gender,
          birth_date: editFields.birth_date || null,
          is_profile_public: editFields.is_profile_public,
          tcg_ids: editFields.tcg_ids,
        },
      });
      toast.success("Información actualizada correctamente");
      setEditMode(false);
      const d = await fetchDetail({ data: { player_id: detailModal } });
      setDetailData(d);
      refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSavingDetail(false);
    }
  };


  // debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // load stores once
  useEffect(() => {
    if (!email) return;
    fetchStores()
      .then((r) => setStores((r.stores as Store[]) ?? []))
      .catch(() => toast.error("Error al cargar las tiendas. Intenta de nuevo."));
  }, [email, fetchStores]);

  // tab presets — reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [tab, roleFilter, activeFilter, storeFilter, sort, search]);

  // effective role based on tab
  const effectiveRole: "all" | Role =
    tab === "organizers"
      ? "organizer"
      : tab === "managers"
        ? "tcg_manager"
        : tab === "admins"
          ? "admin"
          : roleFilter;

  // fetch players
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    fetchPlayers({
      data: { search: search || undefined,
        role: effectiveRole,
        active: activeFilter,
        store_id: storeFilter !== "all" ? storeFilter : undefined,
        sort,
        page,
        include_last_sign_in: tab === "admins",
      },
    })
      .then((r) => {
        if (cancelled) return;
        setPlayers((r.players as P[]) ?? []);
        setTotal(r.total ?? 0);
      })
      .catch((e) => {
        if (!cancelled) toast.error(String((e as Error).message ?? e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [email, search, effectiveRole, activeFilter, storeFilter, sort, page, tab, fetchPlayers]);

  const refresh = () => {
    // bump via no-op state change
    setPage((p) => p);
    if (email) {
      fetchPlayers({
        data: { search: search || undefined,
          role: effectiveRole,
          active: activeFilter,
          store_id: storeFilter !== "all" ? storeFilter : undefined,
          sort,
          page,
          include_last_sign_in: tab === "admins",
        },
      }).then((r) => {
        setPlayers((r.players as P[]) ?? []);
        setTotal(r.total ?? 0);
      });
    }
  };

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (tab === "all" && roleFilter !== "all") n++;
    if (activeFilter !== "all") n++;
    if (storeFilter !== "all") n++;
    if (sort !== "recent") n++;
    if (search) n++;
    return n;
  }, [tab, roleFilter, activeFilter, storeFilter, sort, search]);

  const clearFilters = () => {
    setRoleFilter("all");
    setActiveFilter("all");
    setStoreFilter("all");
    setSort("recent");
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const storeName = (id: string | null) =>
    id ? stores.find((s) => s.id === id)?.name ?? "—" : "—";

  // actions
  const confirmRoleChange = async () => {
    if (!roleModal || !email) return;
    setActing(true);
    try {
      await setRole({
        data: { player_id: roleModal.p.id, role: roleModal.next },
      });
      toast.success("Rol actualizado");
      setRoleModal(null);
      refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActing(false);
    }
  };

  const confirmStoreChange = async () => {
    if (!storeModal || !email) return;
    setActing(true);
    try {
      await setRole({
        data: { player_id: storeModal.p.id,
          role: storeModal.p.role,
          home_store_id: storeModal.next || null,
        },
      });
      toast.success("Tienda asignada");
      setStoreModal(null);
      refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActing(false);
    }
  };

  const confirmToggleActive = async () => {
    if (!activeModal || !email) return;
    setActing(true);
    try {
      await setActive({
        data: { player_id: activeModal.id, is_active: !activeModal.is_active },
      });
      toast.success(activeModal.is_active ? "Cuenta desactivada" : "Cuenta activada");
      setActiveModal(null);
      refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Comunidad
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Jugadores</h1>
          <p className="mt-1 text-sm text-gray-400">
            Administra roles, tiendas y estado de cuenta a escala.
          </p>
        </header>

        {/* Tabs */}
        <div className="glass inline-flex rounded-2xl p-1">
          {([
            { k: "all", label: "Todos" },
            { k: "organizers", label: "Organizadores" },
            { k: "managers", label: "TCG Managers" },
            { k: "admins", label: "Administradores" },
          ] as { k: Tab; label: string }[]).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                tab === t.k
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div className="glass space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Search size={16} className="ml-2 text-gray-500" />
            <Input
              placeholder="Buscar por geek tag (o escribe @ para buscar por email)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0"
            />
            {searchInput && (
              <Button variant="ghost" size="sm" onClick={() => setSearchInput("")}>
                <X size={14} />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tab === "all" && (
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="tcg_manager">TCG Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="true">Activo</SelectItem>
                <SelectItem value="false">Inactivo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Tienda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las tiendas</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.city ? ` — ${s.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="geek_tag">Geek Tag (A-Z)</SelectItem>
                <SelectItem value="points">Puntos totales</SelectItem>
              </SelectContent>
            </Select>

            {activeFiltersCount > 0 && (
              <>
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount} filtro{activeFiltersCount !== 1 ? "s" : ""}
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Counter */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            Mostrando {rangeStart.toLocaleString("es-MX")}–{rangeEnd.toLocaleString("es-MX")} de{" "}
            {total.toLocaleString("es-MX")} jugadores
          </span>
          <span>
            Página {page} de {totalPages}
          </span>
        </div>

        {/* Table */}
        <div className="glass overflow-hidden rounded-2xl">
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : players.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <Users className="text-gray-600" />
              No hay jugadores que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Geek Tag</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">
                      {tab === "organizers" ? "Tienda asignada" : "Tienda"}
                    </th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">
                      {tab === "admins" ? "Último acceso" : "Registro"}
                    </th>
                    <th className="px-4 py-3 text-right">Acciones</th>
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
                        {p.role === "tcg_manager" &&
                        p.manager_games &&
                        p.manager_games.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.manager_games.map((mg) => (
                              <Badge
                                key={mg.game_id}
                                variant="outline"
                                className="border-primary/40 text-[10px] text-primary"
                              >
                                {mg.games?.name ?? mg.game_id}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{p.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            p.role === "admin"
                              ? "default"
                              : p.role === "organizer"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {p.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <div className="flex items-center gap-2">
                          <span>{storeName(p.home_store_id)}</span>
                          {tab === "organizers" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setStoreModal({ p, next: p.home_store_id ?? "" })
                              }
                            >
                              Reasignar
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-300">
                            Activo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/15 text-red-300">Inactivo</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {tab === "admins"
                          ? p.last_sign_in_at
                            ? new Date(p.last_sign_in_at).toLocaleDateString("es-MX")
                            : "—"
                          : new Date(p.created_at).toLocaleDateString("es-MX")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          p={p}
                          onViewDetail={() => openDetail(p.id)}
                          onChangeRole={(next) => setRoleModal({ p, next })}
                          onAssignStore={() =>
                            setStoreModal({ p, next: p.home_store_id ?? "" })
                          }
                          onToggleActive={() => {
                            if (p.is_active) setActiveModal(p);
                            else void setActive({
                              data: { player_id: p.id, is_active: true },
                            }).then(() => {
                              toast.success("Cuenta activada");
                              refresh();
                            });
                          }}
                          onAssignGames={() => {
                            toast.info("Asignación de TCGs próximamente");
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={14} /> Anterior
          </Button>
          <span className="text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente <ChevronRight size={14} />
          </Button>
        </div>

        {/* Role change modal */}
        <Dialog open={!!roleModal} onOpenChange={(o) => !o && setRoleModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar cambio de rol</DialogTitle>
              <DialogDescription>
                {roleModal && (
                  <>
                    ¿Confirmas cambiar el rol de{" "}
                    <strong className="text-white">{roleModal.p.geek_tag}</strong> a{" "}
                    <strong className="text-white">{roleModal.next}</strong>? Esta acción
                    modifica sus permisos inmediatamente.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {roleModal && (
              <Select
                value={roleModal.next}
                onValueChange={(v) =>
                  setRoleModal({ ...roleModal, next: v as Role })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">player</SelectItem>
                  <SelectItem value="organizer">organizer</SelectItem>
                  <SelectItem value="tcg_manager">tcg_manager</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRoleModal(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmRoleChange} disabled={acting}>
                {acting ? <Loader2 className="animate-spin" size={14} /> : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Store modal */}
        <Dialog open={!!storeModal} onOpenChange={(o) => !o && setStoreModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar tienda</DialogTitle>
              <DialogDescription>
                {storeModal && (
                  <>
                    Selecciona la tienda para{" "}
                    <strong className="text-white">{storeModal.p.geek_tag}</strong>.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {storeModal && (
              <Select
                value={storeModal.next || "__none"}
                onValueChange={(v) =>
                  setStoreModal({ ...storeModal, next: v === "__none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin tienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin tienda</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.city ? ` — ${s.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStoreModal(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmStoreChange} disabled={acting}>
                {acting ? <Loader2 className="animate-spin" size={14} /> : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deactivate modal */}
        <Dialog open={!!activeModal} onOpenChange={(o) => !o && setActiveModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Desactivar cuenta</DialogTitle>
              <DialogDescription>
                {activeModal && (
                  <>
                    ¿Desactivar la cuenta de{" "}
                    <strong className="text-white">{activeModal.geek_tag}</strong>? El
                    jugador no podrá iniciar sesión.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setActiveModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmToggleActive}
                disabled={acting}
              >
                {acting ? <Loader2 className="animate-spin" size={14} /> : "Desactivar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function RowActions({
  p,
  onViewDetail,
  onChangeRole,
  onAssignStore,
  onToggleActive,
  onAssignGames,
}: {
  p: P;
  onViewDetail: () => void;
  onChangeRole: (next: Role) => void;
  onAssignStore: () => void;
  onToggleActive: () => void;
  onAssignGames: () => void;
}) {
  const canAssignStore = p.role === "organizer";
  const canAssignGames = p.role === "tcg_manager";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onViewDetail}>
          <Eye size={14} className="mr-2" /> Ver perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChangeRole("player")}>
          <UserCog size={14} className="mr-2" /> Cambiar a player
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeRole("organizer")}>
          <UserCog size={14} className="mr-2" /> Cambiar a organizer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeRole("tcg_manager")}>
          <UserCog size={14} className="mr-2" /> Cambiar a TCG Manager
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChangeRole("admin")}>
          <ShieldCheck size={14} className="mr-2" /> Cambiar a admin
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canAssignStore ? (
          <DropdownMenuItem onClick={onAssignStore}>
            <StoreIcon size={14} className="mr-2" /> Asignar tienda
          </DropdownMenuItem>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem disabled>
                  <StoreIcon size={14} className="mr-2" /> Asignar tienda
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent>Solo disponible para organizadores</TooltipContent>
          </Tooltip>
        )}
        {canAssignGames ? (
          <DropdownMenuItem onClick={onAssignGames}>
            <ShieldCheck size={14} className="mr-2" /> Asignar TCGs
          </DropdownMenuItem>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem disabled>
                  <ShieldCheck size={14} className="mr-2" /> Asignar TCGs
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent>Solo disponible para TCG Managers</TooltipContent>
          </Tooltip>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleActive}>
          <Power size={14} className="mr-2" />
          {p.is_active ? "Desactivar cuenta" : "Activar cuenta"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Users(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={props.className}
      width="32"
      height="32"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
