// Avisos al canal #staff de Discord. Salen de logAction, así que solo avisa lo que la
// auditoría registra. Lista cerrada a propósito: lo rutinario no llega al canal.
// Nunca agregar correos, Bandai IDs ni otros datos personales a estos mensajes.

type Meta = Record<string, unknown> | null | undefined;
type Alert = { title: string; detail?: (meta: Meta) => string | null };

const count = (value: unknown) => (Array.isArray(value) ? value.length : 0);

const ALERTS: Record<string, Alert> = {
  // Requieren acción
  STORE_SIGNUP_SUBMITTED: { title: "🏪 Nueva tienda por revisar" },
  TOURNAMENT_UPLOADED: {
    title: "📥 Torneo subido",
    detail: (m) => (m?.published_directly ? "Publicado directo en liga interna." : "Por revisar."),
  },
  APPEAL_CREATED: { title: "⚖️ Nueva apelación" },
  // Cambios sensibles
  ROLE_CHANGED: {
    title: "🔑 Cambio de rol",
    detail: (m) => (m?.new_role ? `Nuevo rol: ${String(m.new_role)}` : null),
  },
  ACCOUNT_DELETED: { title: "🗑️ Cuenta eliminada" },
  TOURNAMENT_UNPUBLISHED: { title: "⚠️ Torneo despublicado" },
  TOURNAMENT_APPROVED_OVERRIDE: { title: "⚠️ Aprobación forzada" },
  APPROVAL_UNDONE: { title: "↩️ Aprobación deshecha" },
  SEASON_ACTIVATED: { title: "📅 Temporada activada" },
  SEASON_CLOSED: { title: "📅 Temporada cerrada" },
  // Sistema
  SCHEDULED_PUBLICATION_RUN_FINISHED: {
    title: "🤖 Publicación automática",
    detail: (m) => {
      const failures = count(m?.recompute_failures) + count(m?.achievement_failures);
      const summary = `Publicados: ${count(m?.published)} · Omitidos: ${count(m?.skipped)}`;
      return failures > 0 ? `${summary} · ⚠️ Fallas: ${failures}` : summary;
    },
  },
  STORE_SIGNUP_ORPHAN_ACCOUNT: { title: "🚨 Cuenta huérfana en registro de tienda" },
};

// Quien registra una tienda escribe el nombre: sin esto podría disfrazar enlaces en el canal.
function plain(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/([\\`*_~|[\]()<>#])/g, "\\$1")
    .slice(0, 200);
}

export function staffAlertText(
  action: string,
  actorTag: string,
  label: string,
  metadata?: unknown,
): string | null {
  const alert = ALERTS[action];
  if (!alert) return null;
  const lines = [`**${alert.title}**`, plain(label)];
  const detail = alert.detail?.(metadata as Meta);
  if (detail) lines.push(detail);
  if (actorTag && actorTag !== "Sistema") lines.push(`Por: ${plain(actorTag)}`);
  return lines.join("\n");
}

/** Nunca lanza: un fallo de Discord no debe romper la acción que se está auditando. */
export async function notifyStaff(
  action: string,
  actorTag: string,
  label: string,
  metadata?: unknown,
): Promise<void> {
  const webhook = process.env.DISCORD_STAFF_WEBHOOK_URL;
  const content = staffAlertText(action, actorTag, label, metadata);
  if (!webhook || !content) return;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // parse vacío: un nombre con @everyone no debe notificar a nadie.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error("staff alert failed:", action, res.status);
  } catch (e) {
    // El error puede incluir la URL secreta del webhook: solo se registra su tipo.
    console.error("staff alert failed:", action, (e as Error).name);
  }
}
