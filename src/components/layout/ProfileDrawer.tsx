import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, X } from "lucide-react";
import { nexus } from "@/integrations/nexus/client";
import { playerNavSections } from "@/components/layout/player-nav";

// 1. El prop player ya tiene role — confirma que el tipo lo incluye:
type ProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  player: {
    id: string;
    geek_tag: string;
    avatar_url: string | null;
    role: string; // "player" | "organizer" | "tcg_manager" | "admin"
  };
};

export function ProfileDrawer({ open, onClose, player }: ProfileDrawerProps) {
  const initials = player.geek_tag?.slice(0, 2).toUpperCase() ?? "GA";

  const handleLogout = async () => {
    await nexus.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            id="profile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de perfil"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="fixed left-0 top-0 bottom-0 z-[71] flex w-[86%] max-w-sm flex-col border-r border-white/10 bg-[#0B1220]/95 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#2A3A57] bg-[#111A2E]">
                  {player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.geek_tag}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-[#32D9FF]">{initials}</span>
                  )}
                </div>
                <div>
                  <p className="font-mono-stat text-base font-bold text-white">{player.geek_tag}</p>
                  <Link
                    to="/players/$playerTag"
                    params={{ playerTag: player.geek_tag }}
                    onClick={onClose}
                    className="text-xs text-[#32D9FF] hover:underline"
                  >
                    Ver perfil público →
                  </Link>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-md p-1 text-gray-400 transition hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav sections — misma fuente de verdad que PlayerSidebar */}
            <div className="flex-1 overflow-y-auto p-4">
              {playerNavSections(player.role, player.geek_tag).map((sec) => (
                <Section key={sec.title} title={sec.title}>
                  {sec.items.map((item) => (
                    <DrawerLink key={item.to} to={item.to} onClose={onClose}>
                      <span className="flex items-center gap-2.5 text-gray-400">{item.icon}</span>
                      {item.label}
                    </DrawerLink>
                  ))}
                </Section>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t border-white/10 p-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {title}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function DrawerLink({
  to,
  onClose,
  children,
}: {
  to: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white transition hover:bg-white/5"
    >
      {children}
    </Link>
  );
}
