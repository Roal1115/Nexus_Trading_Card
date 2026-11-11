// Etiquetas de las acciones de admin_audit_log (Registro e Inicio).
export type ActionInfo = { label: string; icon: string; color: string };

export const ACTION_LABELS: Record<string, ActionInfo> = {
  TOURNAMENT_APPROVED: { label: "Torneo aprobado", icon: "✅", color: "text-green-400" },
  TOURNAMENT_REJECTED: { label: "Torneo rechazado", icon: "❌", color: "text-red-400" },
  TOURNAMENT_PUBLISHED: { label: "Torneo publicado", icon: "🚀", color: "text-primary" },
  APPROVAL_UNDONE: { label: "Aprobación deshecha", icon: "↩️", color: "text-yellow-400" },
  ROLE_CHANGED: { label: "Rol modificado", icon: "👤", color: "text-blue-400" },
  ORGANIZER_ASSIGNED: { label: "Organizador asignado", icon: "🏪", color: "text-teal-400" },
  STORE_CREATED: { label: "Tienda creada", icon: "🏪", color: "text-teal-400" },
  STORE_UPDATED: { label: "Tienda editada", icon: "✏️", color: "text-gray-400" },
  SEASON_CREATED: { label: "Temporada creada", icon: "📅", color: "text-purple-400" },
  SEASON_ACTIVATED: { label: "Temporada activada", icon: "▶️", color: "text-green-400" },
  SEASON_CLOSED: { label: "Temporada cerrada", icon: "🔒", color: "text-gray-400" },
  SPONSOR_DELETED: { label: "Sponsor eliminado", icon: "🗑️", color: "text-red-400" },
  PLAYER_DETAIL_UPDATED: { label: "Perfil de jugador editado", icon: "✏️", color: "text-blue-400" },
  TOURNAMENT_UNPUBLISHED: { label: "Torneo despublicado", icon: "⏸️", color: "text-amber-400" },
  TOURNAMENT_APPROVED_OVERRIDE: {
    label: "Rechazo anulado por admin",
    icon: "⚖️",
    color: "text-orange-400",
  },
  TOURNAMENT_UPLOADED: { label: "Torneo subido", icon: "📤", color: "text-sky-400" },
  TOURNAMENT_LEAGUE_CHANGED: {
    label: "Liga del torneo cambiada",
    icon: "🔁",
    color: "text-purple-400",
  },
  LEADERBOARD_RECOMPUTED: { label: "Ranking recalculado", icon: "🧮", color: "text-teal-400" },
  SCHEDULED_PUBLICATION_RUN_STARTED: {
    label: "Publicación programada iniciada",
    icon: "⏱️",
    color: "text-gray-400",
  },
  SCHEDULED_PUBLICATION_RUN_FINISHED: {
    label: "Publicación programada terminada",
    icon: "✅",
    color: "text-gray-400",
  },
  SEASON_UPDATED: { label: "Temporada editada", icon: "📅", color: "text-purple-400" },
  DATA_CORRECTED: { label: "Corrección de datos", icon: "🛠️", color: "text-gray-400" },
};
