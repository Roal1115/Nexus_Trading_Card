import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { ZONE_COLORS } from "@/lib/game-colors";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Lo que la tabla necesita de cada torneo del calendario (Admin y Manager). */
export type TournamentDetailEntry = {
  id: string;
  store_name: string;
  city: string;
  zone: string;
  phone: string | null;
  organizer_tag: string | null;
  organizer_phone: string | null;
  report_status: string;
  day_of_week: number;
  start_time: string;
  date: string;
};

const waHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    submitted: { label: "Enviado", className: "bg-green-500/20 text-green-400" },
    overdue: { label: "Overdue", className: "bg-red-500/20 text-red-400" },
    cancelled: { label: "Cancelado", className: "bg-red-500/20 text-red-300" },
    pending: { label: "Pendiente", className: "bg-yellow-500/20 text-yellow-400" },
    upcoming: { label: "Próximo", className: "bg-gray-500/20 text-gray-400" },
  };
  const s = map[status] ?? map.upcoming;
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${s.className}`}
    >
      {s.label}
    </span>
  );
}

/** Un teléfono con su botón de WhatsApp. `who` dice de quién es, para lectores de pantalla. */
export function PhoneLink({ phone, who }: { phone: string | null; who: string }) {
  if (!phone) return <span className="text-xs text-gray-500">Sin teléfono registrado</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm tabular-nums text-gray-200">{phone}</span>
      <a
        href={waHref(phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp de ${who}`}
        title="Abrir WhatsApp"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-400/30 text-green-400 transition hover:bg-green-400/10"
      >
        <MessageCircle size={14} />
      </a>
    </span>
  );
}

/**
 * Contacto del encargado: es a quien se le escribe si falta subir el torneo. Su número es el
 * "Contacto principal" de Staff; el de la tienda no sirve para eso y no se muestra aquí.
 */
export function TournamentContacts({ entry }: { entry: TournamentDetailEntry }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-[10px] uppercase text-gray-500">Encargado</div>
      {entry.organizer_tag ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-white">{entry.organizer_tag}</div>
          <PhoneLink phone={entry.organizer_phone} who={entry.organizer_tag} />
        </div>
      ) : (
        <div className="mt-1 text-sm text-gray-500">Sin encargado asignado</div>
      )}
    </div>
  );
}

/** Tabla "Detalle de torneos" del calendario, con buscador por tienda o encargado. */
export function TournamentDetailsTable({ entries }: { entries: TournamentDetailEntry[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.store_name} ${e.organizer_tag ?? ""}`.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
        <h2 className="text-lg font-bold text-foreground">Detalle de torneos</h2>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por tienda o encargado"
          className="max-w-sm"
        />
      </header>

      {visible.length === 0 ? (
        <EmptyState
          title={query.trim() ? "No hay torneos que coincidan" : "No hay torneos esta semana"}
          description={
            query.trim() ? "Prueba con otro nombre de tienda o de encargado." : undefined
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Tienda
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Zona
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Día / Hora
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Encargado
                  </th>
                  <th scope="col" className="px-4 py-3">
                    WhatsApp
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const zoneColor = ZONE_COLORS[e.zone] ?? ZONE_COLORS["Zona Extendida"];
                  return (
                    <tr key={e.id} className="border-t border-white/5 transition hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{e.store_name}</div>
                        <div className="text-xs text-gray-400">{e.city}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${zoneColor.bg} ${zoneColor.text} ${zoneColor.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${zoneColor.dot}`} />
                          {e.zone.replace("Zona ", "")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {DAY_NAMES[e.day_of_week]} · {e.start_time.slice(0, 5)}
                        <div className="text-xs text-gray-500">{e.date}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.report_status} />
                      </td>
                      <td className="px-4 py-3">
                        {e.organizer_tag ? (
                          <span className="text-sm text-white">{e.organizer_tag}</span>
                        ) : (
                          <span className="text-xs text-gray-500">Sin encargado</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {e.organizer_tag && (
                          <PhoneLink phone={e.organizer_phone} who={e.organizer_tag} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/5 sm:hidden">
            {visible.map((e) => {
              const zoneColor = ZONE_COLORS[e.zone] ?? ZONE_COLORS["Zona Extendida"];
              return (
                <div key={e.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white">{e.store_name}</div>
                    <StatusBadge status={e.report_status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${zoneColor.bg} ${zoneColor.text}`}
                    >
                      {e.zone.replace("Zona ", "")}
                    </span>
                    <span>·</span>
                    <span>
                      {DAY_NAMES[e.day_of_week]} {e.start_time.slice(0, 5)}
                    </span>
                    <span>·</span>
                    <span>{e.city}</span>
                  </div>
                  <TournamentContacts entry={e} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
