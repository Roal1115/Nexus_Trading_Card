import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { nexus } from "@/integrations/nexus/client";
import { useNexusRole } from "@/hooks/use-nexus-role";

type NotificationRow = {
  id: string;
  player_id: string;
  type: string | null;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

const db = nexus as unknown as {
  from: (table: "notifications") => any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => void;
};

export function NotificationBell({
  className = "",
  variant = "icon",
  collapsed = false,
}: {
  className?: string;
  /** "icon": botón redondo (header). "sidebar": fila de navegación de ancho completo. */
  variant?: "icon" | "sidebar";
  collapsed?: boolean;
}) {
  const { player } = useNexusRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const playerId = player?.id ?? null;
  const unreadCount = items.filter((n) => !n.read_at).length;

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!playerId) {
      setItems([]);
      return;
    }
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await db
        .from("notifications")
        .select("id, player_id, type, title, body, url, read_at, created_at")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!mounted) return;
      setItems((data as NotificationRow[]) ?? []);
      setLoading(false);
    };
    load();

    // Nombre único por montaje: en StrictMode el efecto corre dos veces y un
    // nombre fijo hace que supabase-js reutilice el canal ya suscrito del
    // primer montaje, provocando "cannot add callbacks after subscribe()".
    const channel = db
      .channel(`notifications:${playerId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `player_id=eq.${playerId}`,
        },
        (payload: any) => {
          if (!mounted) return;
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as NotificationRow;
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev].slice(0, 20);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as NotificationRow;
              return prev.map((n) => (n.id === row.id ? row : n));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as NotificationRow;
              return prev.filter((n) => n.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      db.removeChannel(channel);
    };
  }, [playerId]);

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPanel = () => {
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  };

  const markOneRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
    );
    await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  };

  const markAllRead = async () => {
    if (!playerId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await db
      .from("notifications")
      .update({ read_at: now })
      .eq("player_id", playerId)
      .is("read_at", null);
  };

  const onRowClick = async (n: NotificationRow) => {
    setOpen(false);
    if (!n.read_at) markOneRead(n.id);
    if (n.url) {
      if (/^https?:\/\//i.test(n.url)) {
        window.location.href = n.url;
      } else {
        navigate({ to: n.url });
      }
    }
  };

  if (!player) return null;

  // Siempre dentro del viewport. En sidebar abre a la derecha del botón;
  // en header abre debajo, alineado a su borde derecho.
  const panelWidth = anchorRect ? Math.min(380, window.innerWidth - 16) : 380;
  const clampLeft = (left: number) =>
    Math.min(Math.max(left, 8), window.innerWidth - panelWidth - 8);
  const panelStyle: React.CSSProperties | undefined = anchorRect
    ? variant === "sidebar"
      ? {
          position: "fixed",
          top: Math.max(Math.min(anchorRect.top, window.innerHeight - 440), 8),
          left: clampLeft(anchorRect.right + 12),
          width: panelWidth,
          zIndex: 100,
        }
      : {
          position: "fixed",
          top: Math.min(anchorRect.bottom + 8, window.innerHeight - 20),
          left: clampLeft(anchorRect.right - panelWidth),
          width: panelWidth,
          zIndex: 100,
        }
    : undefined;

  return (
    <>
      {variant === "sidebar" ? (
        <button
          ref={btnRef}
          type="button"
          onClick={openPanel}
          title={collapsed ? "Notificaciones" : undefined}
          aria-label="Notificaciones"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex w-full items-center overflow-hidden rounded-md py-2 text-sm transition ${
            collapsed ? "justify-center px-0" : "gap-2.5 px-3"
          } ${
            open ? "bg-primary/15 text-primary" : "text-gray-300 hover:bg-white/5 hover:text-white"
          } ${className}`}
        >
          <span className="relative shrink-0">
            <Bell size={16} />
            {collapsed && unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </span>
          <span
            className={`whitespace-nowrap transition-opacity duration-200 ${
              collapsed ? "w-0 opacity-0" : "flex-1 text-left opacity-100"
            }`}
          >
            Notificaciones
          </span>
          {!collapsed && unreadCount > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={openPanel}
          aria-label="Notificaciones"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#C5D1E4] transition hover:border-primary/40 hover:text-primary ${className}`}
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0f1117]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notificaciones"
            style={panelStyle}
            className="overflow-hidden rounded-xl border border-white/10 bg-[#0f1117]/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white">Notificaciones</div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:brightness-110"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-[#7A8CAD]">Cargando…</div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-[#7A8CAD]">
                  No tienes notificaciones
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {items.map((n) => {
                    const unread = !n.read_at;
                    let rel = "";
                    try {
                      rel = formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: es,
                      });
                    } catch {
                      rel = "";
                    }
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => onRowClick(n)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] ${
                            unread ? "bg-primary/[0.06]" : ""
                          }`}
                        >
                          <span
                            className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                              unread ? "bg-primary shadow-[0_0_6px_rgba(50,217,255,0.7)]" : "bg-transparent"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div
                                className={`truncate text-sm ${
                                  unread ? "font-semibold text-white" : "font-medium text-[#C5D1E4]"
                                }`}
                              >
                                {n.title}
                              </div>
                              <div className="shrink-0 text-[10px] uppercase tracking-wide text-[#7A8CAD]">
                                {rel}
                              </div>
                            </div>
                            {n.body && (
                              <div className="mt-0.5 line-clamp-2 text-xs text-[#7A8CAD]">
                                {n.body}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
