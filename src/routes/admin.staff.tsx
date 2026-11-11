import { createFileRoute } from "@tanstack/react-router";
import { usePagination } from "@/hooks/use-pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TablePager } from "@/components/ui/table-pager";
import { DetailDialog, openRowProps } from "@/components/ui/detail-dialog";
import { PhoneLink } from "@/components/calendar/tournament-details";

const ROLE_STYLE: Record<StaffRole, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-red-500/20 text-red-400" },
  tcg_manager: { label: "TCG Manager", className: "bg-blue-500/20 text-blue-400" },
  organizer: { label: "Organizador", className: "bg-orange-500/20 text-orange-400" },
};
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Search,
  Store as StoreIcon,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  MoreHorizontal,
  Pencil,
  UserPlus,
  Power,
  PowerOff,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  SkeletonLine,
  SkeletonBlock,
  TournamentRowSkeleton,
} from "@/components/ui/skeleton-loader";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  listStoresWithOrganizers,
  createStore,
  setStoreActive,
  updateStore,
  assignOrganizerToStore,
  listStaffMembers,
  upsertStaffMember,
  getManagerAssignedGames,
  deactivateStaffMember,
  updateStaffOperationalFields,
  getStoreSchedules,
  upsertStoreSchedule,
  deleteStoreSchedule,
} from "@/lib/nexus-admin.functions";
import { assignManagerGames } from "@/lib/nexus-manager.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({ meta: [{ title: "Staff — Nexus" }] }),
  component: StaffTab,
});

// ────────────────────────────────────────────────────────────
// Staff tab
// ────────────────────────────────────────────────────────────
type StaffRole = "tcg_manager" | "organizer" | "admin";
type StaffRow = {
  id: string;
  geek_tag: string;
  email: string | null;
  role: "tcg_manager" | "organizer" | "admin";
  is_active: boolean;
  home_store: { id: string; name: string; city: string | null } | null;
  manager_games: { game_id: string; games?: { id: string; name: string } | null }[];
  work_schedule?: string | null;
  contact_primary?: string | null;
  contact_backup?: string | null;
};

function StaffTab() {
  const fetchStaff = useServerFn(listStaffMembers);
  const upsertStaff = useServerFn(upsertStaffMember);
  const fetchAllStores = useServerFn(listStoresWithOrganizers);
  const fetchManagerGames = useServerFn(getManagerAssignedGames);
  const saveManagerGamesFn = useServerFn(assignManagerGames);
  const assignOrganizerFn = useServerFn(assignOrganizerToStore);
  const deactivateStaffFn = useServerFn(deactivateStaffMember);
  const updateOpFieldsFn = useServerFn(updateStaffOperationalFields);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState<"all" | "tcg_manager" | "organizer" | "admin">("all");
  const [staffSearch, setStaffSearch] = useState("");
  const [viewStaff, setViewStaff] = useState<StaffRow | null>(null);

  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{
    email: string;
    geek_tag: string;
    role: "tcg_manager" | "organizer";
    work_schedule: string;
    contact_primary: string;
    contact_backup: string;
  }>({
    email: "",
    geek_tag: "",
    role: "organizer",
    work_schedule: "",
    contact_primary: "",
    contact_backup: "",
  });
  const [addLoading, setAddLoading] = useState(false);

  const [assignModal, setAssignModal] = useState<{
    player_id: string;
    geek_tag: string;
    role: StaffRow["role"];
  } | null>(null);

  const [allGames, setAllGames] = useState<{ id: string; name: string }[]>([]);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [allStores, setAllStores] = useState<{ id: string; name: string; city: string | null }[]>(
    [],
  );
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [opFields, setOpFields] = useState<{
    work_schedule: string;
    contact_primary: string;
    contact_backup: string;
  }>({ work_schedule: "", contact_primary: "", contact_backup: "" });

  const [confirmAction, setConfirmAction] = useState<{
    player: StaffRow;
    action: "deactivate" | "delete";
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return staff
      .filter((p) => roleTab === "all" || p.role === roleTab)
      .filter((p) => !q || `${p.geek_tag} ${p.email ?? ""}`.toLowerCase().includes(q));
  }, [staff, roleTab, staffSearch]);
  const pager = usePagination(filteredStaff);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = (await fetchStaff()) as StaffRow[];
      setStaff(data);
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAssignmentFor = async (
    player_id: string,
    geek_tag: string,
    role: StaffRow["role"],
    currentStoreId?: string,
  ) => {
    setAssignModal({ player_id, geek_tag, role });
    const current = staff.find((s) => s.id === player_id);
    setOpFields({
      work_schedule: current?.work_schedule ?? "",
      contact_primary: current?.contact_primary ?? "",
      contact_backup: current?.contact_backup ?? "",
    });
    if (role === "tcg_manager") {
      const gRes: any = await fetchManagerGames({ data: { player_id } });
      setAllGames(gRes.all_games ?? []);
      setSelectedGames(new Set(gRes.assigned_game_ids ?? []));
    } else {
      const sRes: any = await fetchAllStores();
      setAllStores((sRes.stores ?? []) as any[]);
      setSelectedStore(currentStoreId ?? "");
    }
  };

  const handleAddStaff = async () => {
    if (!addForm.email || !addForm.geek_tag) return;
    setAddLoading(true);
    try {
      const res: any = await upsertStaff({ data: addForm });
      toast.success(
        res.was_existing
          ? `Usuario existente actualizado al rol ${addForm.role}`
          : "Staff creado correctamente",
      );
      const playerId = res.player_id as string | null;
      const role = addForm.role;
      const nexusTag = addForm.geek_tag;
      setAddModal(false);
      setAddForm({
        email: "",
        geek_tag: "",
        role: "organizer",
        work_schedule: "",
        contact_primary: "",
        contact_backup: "",
      });
      await refresh();
      if (playerId) {
        await openAssignmentFor(playerId, nexusTag, role);
      }
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setAddLoading(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!assignModal) return;
    setAssignLoading(true);
    try {
      if (assignModal.role === "tcg_manager") {
        await saveManagerGamesFn({
          data: {
            player_id: assignModal.player_id,
            game_ids: Array.from(selectedGames),
          },
        });
        toast.success("TCGs asignados correctamente");
      } else {
        if (!selectedStore) {
          toast.error("Selecciona una tienda");
          setAssignLoading(false);
          return;
        }
        await assignOrganizerFn({
          data: {
            player_id: assignModal.player_id,
            store_id: selectedStore,
          },
        });
        toast.success("Tienda asignada correctamente");
      }
      await updateOpFieldsFn({
        data: {
          player_id: assignModal.player_id,
          work_schedule: opFields.work_schedule.trim() || null,
          contact_primary: opFields.contact_primary.trim() || null,
          contact_backup: opFields.contact_backup.trim() || null,
        },
      });
      setAssignModal(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Red</p>
          <h1 className="text-3xl font-bold text-white">Staff</h1>
          <p className="text-sm text-gray-400">
            Managers y organizadores activos en la plataforma.
          </p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <UserPlus size={14} className="mr-2" />
          Agregar Staff
        </Button>
      </header>

      {/* Role tabs */}
      <div
        role="tablist"
        aria-label="Filtrar por rol"
        className="flex gap-2 border-b border-white/10"
      >
        {(
          [
            { k: "all", label: "Todos" },
            { k: "admin", label: "Admins" },
            { k: "tcg_manager", label: "Managers" },
            { k: "organizer", label: "Organizadores" },
          ] as const
        ).map((t) => {
          const count = t.k === "all" ? staff.length : staff.filter((s) => s.role === t.k).length;
          return (
            <button
              key={t.k}
              role="tab"
              aria-selected={roleTab === t.k}
              onClick={() => setRoleTab(t.k)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                roleTab === t.k
                  ? "border-primary text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {t.label} <span className="ml-1 text-xs text-gray-500">({count})</span>
            </button>
          );
        })}
      </div>

      <section className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <SearchInput
          value={staffSearch}
          onChange={setStaffSearch}
          placeholder="Buscar por Nexus Tag o correo"
        />
      </section>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Nexus Tag
                </th>
                <th scope="col" className="px-4 py-3">
                  Email
                </th>
                <th scope="col" className="px-4 py-3">
                  Rol
                </th>
                <th scope="col" className="px-4 py-3">
                  Asignación
                </th>
                <th scope="col" className="px-4 py-3">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="px-4 py-3">
                    <SkeletonLine width="w-24" height="h-3" />
                  </td>
                  <td className="px-4 py-3">
                    <SkeletonLine width="w-32" height="h-3" />
                  </td>
                  <td className="px-4 py-3">
                    <SkeletonLine width="w-16" height="h-5" className="rounded-md" />
                  </td>
                  <td className="px-4 py-3">
                    <SkeletonLine width="w-24" height="h-3" />
                  </td>
                  <td className="px-4 py-3">
                    <SkeletonLine width="w-14" height="h-5" className="rounded-md" />
                  </td>
                  <td className="px-4 py-3">
                    <SkeletonBlock className="w-6 h-6 rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Nexus Tag
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Rol
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Asignación
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Sin staff registrado.
                      </td>
                    </tr>
                  ) : (
                    pager.pageItems.map((p) => (
                      <tr
                        key={p.id}
                        {...openRowProps(() => setViewStaff(p))}
                        className="cursor-pointer border-t border-white/5 transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                      >
                        <td className="px-4 py-3 text-white font-medium">{p.geek_tag}</td>
                        <td className="px-4 py-3 text-gray-300">{p.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              p.role === "admin"
                                ? "bg-red-500/20 text-red-400"
                                : p.role === "tcg_manager"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-orange-500/20 text-orange-400"
                            }
                          >
                            {p.role === "admin"
                              ? "Admin"
                              : p.role === "tcg_manager"
                                ? "TCG Manager"
                                : "Organizador"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {p.role === "tcg_manager" && p.manager_games?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {p.manager_games.map((mg) => (
                                <span
                                  key={mg.game_id}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                                >
                                  {mg.games?.name}
                                </span>
                              ))}
                            </div>
                          ) : p.role === "organizer" && p.home_store ? (
                            <span className="text-xs text-gray-300">
                              {p.home_store.name}
                              {p.home_store.city ? ` · ${p.home_store.city}` : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Sin asignar</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.is_active ? "default" : "secondary"}>
                            {p.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                aria-label="Más acciones"
                                className="p-1.5 rounded hover:bg-white/10 text-gray-300"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                                }
                              >
                                <Info size={14} className="mr-2" />
                                Info
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                                }
                              >
                                <UserPlus size={14} className="mr-2" />
                                {p.role === "tcg_manager" ? "Asignar TCGs" : "Asignar tienda"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {p.is_active ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmAction({ player: p, action: "deactivate" })
                                  }
                                  className="text-amber-400 focus:text-amber-300"
                                >
                                  <PowerOff size={14} className="mr-2" />
                                  Desactivar
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({ player: p, action: "delete" })}
                                className="text-red-400 focus:text-red-300"
                              >
                                <Power size={14} className="mr-2" />
                                Quitar del staff
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-white/5">
              {filteredStaff.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Sin staff registrado.
                </div>
              ) : (
                pager.pageItems.map((p) => (
                  <div
                    key={p.id}
                    {...openRowProps(() => setViewStaff(p))}
                    className="cursor-pointer space-y-2 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-medium">{p.geek_tag}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            p.role === "admin"
                              ? "bg-red-500/20 text-red-400"
                              : p.role === "tcg_manager"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-orange-500/20 text-orange-400"
                          }
                        >
                          {p.role === "admin"
                            ? "Admin"
                            : p.role === "tcg_manager"
                              ? "Manager"
                              : "Org"}
                        </Badge>
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{p.email ?? "—"}</div>
                    {p.role === "tcg_manager" && p.manager_games?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.manager_games.map((mg) => (
                          <span
                            key={mg.game_id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                          >
                            {mg.games?.name}
                          </span>
                        ))}
                      </div>
                    ) : p.role === "organizer" && p.home_store ? (
                      <div className="text-xs text-gray-300">
                        {p.home_store.name}
                        {p.home_store.city ? ` · ${p.home_store.city}` : ""}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() =>
                          openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        Info
                      </button>
                      <button
                        onClick={() =>
                          openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        {p.role === "tcg_manager" ? "Asignar TCGs" : "Asignar tienda"}
                      </button>
                      {p.is_active ? (
                        <button
                          onClick={() => setConfirmAction({ player: p, action: "deactivate" })}
                          className="text-xs text-amber-400 hover:underline"
                        >
                          Desactivar
                        </button>
                      ) : null}
                      <button
                        onClick={() => setConfirmAction({ player: p, action: "delete" })}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <TablePager
        page={pager.page}
        totalPages={pager.totalPages}
        onPageChange={pager.setPage}
        total={pager.total}
        pageSize={pager.pageSize}
      />

      {viewStaff && (
        <DetailDialog
          open
          onClose={() => setViewStaff(null)}
          title={viewStaff.geek_tag}
          subtitle={viewStaff.email ?? undefined}
          badges={
            <>
              <Badge className={ROLE_STYLE[viewStaff.role].className}>
                {ROLE_STYLE[viewStaff.role].label}
              </Badge>
              <Badge
                className={
                  viewStaff.is_active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-white/10 text-muted-foreground"
                }
              >
                {viewStaff.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </>
          }
          sections={[
            {
              title: "Asignación",
              items:
                viewStaff.role === "tcg_manager"
                  ? [
                      {
                        label: "TCGs que modera",
                        value: viewStaff.manager_games
                          .map((mg) => mg.games?.name)
                          .filter(Boolean)
                          .join(", "),
                        wide: true,
                      },
                    ]
                  : [
                      {
                        label: "Tienda",
                        value: viewStaff.home_store
                          ? [viewStaff.home_store.name, viewStaff.home_store.city]
                              .filter(Boolean)
                              .join(" · ")
                          : "Sin asignar",
                        wide: true,
                      },
                    ],
            },
            {
              title: "Contacto y horario",
              items: [
                {
                  label: "Contacto principal",
                  value: viewStaff.contact_primary && (
                    <PhoneLink phone={viewStaff.contact_primary} who={viewStaff.geek_tag} />
                  ),
                },
                { label: "Contacto de respaldo", value: viewStaff.contact_backup },
                { label: "Horario de trabajo", value: viewStaff.work_schedule, wide: true },
              ],
            },
          ]}
        />
      )}

      {/* Add Staff modal */}
      <Dialog open={addModal} onOpenChange={(o) => !o && setAddModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Staff</DialogTitle>
            <DialogDescription>
              Si el correo ya existe en la plataforma, el sistema actualizará su rol
              automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Correo electrónico *</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Nombre / Nexus Tag *</Label>
              <Input
                value={addForm.geek_tag}
                onChange={(e) => setAddForm((f) => ({ ...f, geek_tag: e.target.value }))}
                placeholder="NexusTag123"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Rol *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["organizer", "tcg_manager"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, role: r }))}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                      addForm.role === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {r === "organizer" ? "Organizador" : "TCG Manager"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Horario de trabajo</Label>
                <Input
                  value={addForm.work_schedule}
                  onChange={(e) => setAddForm((f) => ({ ...f, work_schedule: e.target.value }))}
                  placeholder="Lun-Vie 10:00-19:00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Contacto principal</Label>
                <Input
                  value={addForm.contact_primary}
                  onChange={(e) => setAddForm((f) => ({ ...f, contact_primary: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Contacto secundario</Label>
                <Input
                  value={addForm.contact_backup}
                  onChange={(e) => setAddForm((f) => ({ ...f, contact_backup: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddStaff} disabled={addLoading}>
              {addLoading ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              {addLoading ? "Procesando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment modal */}
      <Dialog open={!!assignModal} onOpenChange={(o) => !o && setAssignModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignModal?.role === "tcg_manager" ? "Asignar TCGs" : "Asignar tienda"}
            </DialogTitle>
            <DialogDescription>
              {assignModal?.role === "tcg_manager"
                ? `Selecciona los juegos que ${assignModal?.geek_tag ?? ""} tendrá bajo su responsabilidad.`
                : `Selecciona la tienda que ${assignModal?.geek_tag ?? ""} administrará.`}
            </DialogDescription>
          </DialogHeader>

          {assignModal?.role === "tcg_manager" ? (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {allGames.map((g) => {
                const isSelected = selectedGames.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setSelectedGames((prev) => {
                        const next = new Set(prev);
                        if (next.has(g.id)) next.delete(g.id);
                        else next.add(g.id);
                        return next;
                      })
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
                      isSelected
                        ? "border-primary bg-primary/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected ? "bg-primary border-primary text-white" : "border-white/20"
                      }`}
                    >
                      {isSelected ? <Check size={12} /> : null}
                    </span>
                    {g.name}
                  </button>
                );
              })}
            </div>
          ) : assignModal ? (
            <div className="space-y-2">
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="— Seleccionar tienda —" />
                </SelectTrigger>
                <SelectContent>
                  {allStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` · ${s.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {assignModal ? (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                Información operativa
              </h4>
              <div>
                <label htmlFor="op-work-schedule" className="text-xs text-gray-400 mb-1 block">
                  Horario / Disponibilidad
                </label>
                <input
                  id="op-work-schedule"
                  value={opFields.work_schedule}
                  onChange={(e) => setOpFields((f) => ({ ...f, work_schedule: e.target.value }))}
                  placeholder="Lun-Vie 18:00-22:00"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label htmlFor="op-contact-primary" className="text-xs text-gray-400 mb-1 block">
                    Contacto principal
                  </label>
                  <input
                    id="op-contact-primary"
                    value={opFields.contact_primary}
                    onChange={(e) =>
                      setOpFields((f) => ({ ...f, contact_primary: e.target.value }))
                    }
                    placeholder="+52 81 1234 5678"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="op-contact-backup" className="text-xs text-gray-400 mb-1 block">
                    Contacto de respaldo
                  </label>
                  <input
                    id="op-contact-backup"
                    value={opFields.contact_backup}
                    onChange={(e) => setOpFields((f) => ({ ...f, contact_backup: e.target.value }))}
                    placeholder="+52 81 9876 5432"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignModal(null)}>
              Omitir
            </Button>
            <Button onClick={handleSaveAssignment} disabled={assignLoading}>
              {assignLoading ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              {assignLoading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate / delete */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "deactivate" ? "Desactivar staff" : "Quitar del staff"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "deactivate"
                ? `Se desactivará la cuenta de ${confirmAction?.player.geek_tag}. Podrá ser reactivada después.`
                : `Se removerá a ${confirmAction?.player.geek_tag} del staff. Su rol pasará a usuario regular y se eliminarán sus asignaciones de TCGs.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirmAction?.action === "delete" ? "destructive" : "default"}
              disabled={confirmLoading}
              onClick={async () => {
                if (!confirmAction) return;
                setConfirmLoading(true);
                try {
                  await deactivateStaffFn({
                    data: {
                      player_id: confirmAction.player.id,
                      action: confirmAction.action,
                    },
                  });
                  toast.success(
                    confirmAction.action === "deactivate" ? "Staff desactivado" : "Staff removido",
                  );
                  setConfirmAction(null);
                  await refresh();
                } catch (e: any) {
                  toast.error(e?.message ?? String(e));
                } finally {
                  setConfirmLoading(false);
                }
              }}
            >
              {confirmLoading ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
