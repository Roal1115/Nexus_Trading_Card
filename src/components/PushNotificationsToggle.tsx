import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { BTN_OUTLINE, SECTION } from "@/components/stores/store-ui";

// Llave pública VAPID (segura de exponer; la privada vive en Vault del backend)
const VAPID_PUBLIC_KEY =
  "BIQ1wevEWWjbeOP-daxMVA8I23IB8aGuA6BLM4wKBmWPk0lIS8myBKM9xGnYe-8oory-9NxWZEPNNqRrj6v5f44";

function urlBase64ToUint8Array(base64: string) {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushNotificationsToggle() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permiso de notificaciones denegado en el navegador");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const { error } = await (nexus as any)
        .from("push_subscriptions")
        .upsert(
          { endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth },
          { onConflict: "endpoint", ignoreDuplicates: true },
        );
      if (error) throw error;
      setEnabled(true);
      toast.success("Notificaciones activadas: te avisaremos de torneos en tus tiendas");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron activar las notificaciones");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await (nexus as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast.success("Notificaciones desactivadas");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al desactivar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="s-notif" className={`${SECTION} space-y-3`}>
      <h2 id="s-notif" className="text-lg font-semibold text-foreground">
        Notificaciones
      </h2>
      <p className="text-sm text-foreground-secondary">
        Recibe un aviso cuando haya torneo al día siguiente en tu tienda principal o en tus tiendas
        favoritas.
      </p>
      {!supported ? (
        <p className="text-sm text-warning">
          Tu navegador no soporta notificaciones push. En iOS, primero instala la app desde
          Compartir → "Agregar a pantalla de inicio".
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={enabled ? disable : enable}
            disabled={busy}
            aria-pressed={enabled}
            className={BTN_OUTLINE}
          >
            {busy ? (
              <Loader2 size={16} aria-hidden="true" className="animate-spin" />
            ) : enabled ? (
              <BellOff size={16} aria-hidden="true" />
            ) : (
              <Bell size={16} aria-hidden="true" />
            )}
            {enabled ? "Desactivar notificaciones" : "Activar notificaciones"}
          </button>
          <span className="text-sm text-foreground-subtle">
            {enabled ? "Activadas en este dispositivo" : "Desactivadas"}
          </span>
        </div>
      )}
    </section>
  );
}
