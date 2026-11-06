import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, Store, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveStoreSignup,
  createStoreInvite,
  getStoreSignupPanel,
  rejectStoreSignup,
  revokeStoreInvite,
} from "@/lib/nexus-store-invites.functions";

type Panel = Awaited<ReturnType<typeof getStoreSignupPanel>>;

const fieldClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

/** Enlaces privados para tiendas y solicitudes por revisar. Admin ve todo; Manager, su TCG. */
export function StoreInvitesPanel({ onApproved }: { onApproved?: () => void }) {
  const fetchPanel = useServerFn(getStoreSignupPanel);
  const createInvite = useServerFn(createStoreInvite);
  const revokeInvite = useServerFn(revokeStoreInvite);
  const approve = useServerFn(approveStoreSignup);
  const reject = useServerFn(rejectStoreSignup);

  const [panel, setPanel] = useState<Panel | null>(null);
  const [email, setEmail] = useState("");
  const [gameId, setGameId] = useState("");
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const refresh = () =>
    fetchPanel()
      .then((res) => {
        setPanel(res);
        setGameId((current) => current || res.games[0]?.id || "");
      })
      .catch(() => toast.error("No se pudieron cargar las invitaciones"));

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (id: string, action: () => Promise<unknown>, done: string) => {
    setBusyId(id);
    try {
      await action();
      toast.success(done);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo completar la acción");
    } finally {
      setBusyId(null);
    }
  };

  const onCreate = async () => {
    setCreating(true);
    try {
      const { token } = await createInvite({ data: { email: email.trim(), game_id: gameId } });
      setLink(`${window.location.origin}/registro-tienda/${token}`);
      setEmail("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el enlace");
    } finally {
      setCreating(false);
    }
  };

  if (!panel) return null;

  return (
    <section className="glass space-y-5 rounded-2xl p-5" aria-labelledby="store-invites-title">
      <div>
        <h2
          id="store-invites-title"
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
        >
          <Store size={16} className="text-primary" /> Registro de tiendas
        </h2>
        <p className="text-sm text-muted-foreground">
          Genera un enlace privado y pásalo directo a la tienda. Sirve una sola vez y vence en 7
          días.
        </p>
      </div>

      {panel.requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Por revisar ({panel.requests.length})
          </h3>
          {panel.requests.map((r) => (
            <div key={r.id} className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{r.store_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.city}, {r.state} · {r.games?.name ?? "TCG"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.email} · {r.phone}
                </p>
              </div>
              {rejecting?.id === r.id ? (
                <div className="space-y-2">
                  <input
                    aria-label="Motivo del rechazo"
                    value={rejecting.reason}
                    onChange={(e) => setRejecting({ id: r.id, reason: e.target.value })}
                    placeholder="Motivo del rechazo"
                    className={fieldClass}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id || rejecting.reason.trim().length < 3}
                      onClick={() =>
                        run(
                          r.id,
                          async () => {
                            await reject({ data: { request_id: r.id, reason: rejecting.reason } });
                            setRejecting(null);
                          },
                          "Solicitud rechazada",
                        )
                      }
                      className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Confirmar rechazo
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(null)}
                      className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() =>
                      run(
                        r.id,
                        async () => {
                          await approve({ data: { request_id: r.id } });
                          onApproved?.();
                        },
                        "Tienda aprobada. Agrégale su horario.",
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busyId === r.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting({ id: r.id, reason: "" })}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
        <input
          type="email"
          aria-label="Correo de la tienda"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo de la tienda"
          className={fieldClass}
        />
        <select
          aria-label="TCG de la tienda"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className={fieldClass}
        >
          {panel.games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={creating || !gameId || !/^\S+@\S+\.\S+$/.test(email.trim())}
          onClick={onCreate}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {creating ? "Generando…" : "Generar enlace"}
        </button>
      </div>

      {link && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            Cópialo ahora: por seguridad no se vuelve a mostrar.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-xs text-foreground">{link}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("Enlace copiado");
              }}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground"
            >
              <Copy size={12} /> Copiar
            </button>
            <button
              type="button"
              aria-label="Cerrar enlace"
              onClick={() => setLink(null)}
              className="flex-shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {panel.invites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Enlaces activos</h3>
          {panel.invites.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{i.email}</p>
                <p className="text-xs text-muted-foreground">
                  {i.games?.name ?? "TCG"} · vence{" "}
                  {new Date(i.expires_at).toLocaleDateString("es-MX")}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === i.id}
                onClick={() =>
                  run(i.id, () => revokeInvite({ data: { invite_id: i.id } }), "Enlace revocado")
                }
                className="flex-shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Revocar
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
