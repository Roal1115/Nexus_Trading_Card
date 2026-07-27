import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";

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
    <section className="glass space-y-4 rounded-2xl p-6">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
        <Bell size={14} className="text-primary" /> Notificaciones
      </h2>
      <p className="text-xs text-gray-400">
        Recibe un aviso cuando haya torneo al día siguiente en tu tienda principal o en tus tiendas
        favoritas.
      </p>
      {!supported ? (
        <p className="text-xs text-amber-400">
          Tu navegador no soporta notificaciones push. En iOS, primero instala la app desde
          Compartir → "Agregar a pantalla de inicio".
        </p>
      ) : (
        <button
          onClick={enabled ? disable : enable}
          disabled={busy}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 ${
            enabled
              ? "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : enabled ? (
            <BellOff size={12} />
          ) : (
            <Bell size={12} />
          )}
          {enabled ? "Desactivar notificaciones" : "Activar notificaciones"}
        </button>
      )}
    </section>
  );
}
