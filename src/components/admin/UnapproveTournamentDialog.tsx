import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function UnapproveTournamentDialog({
  tournament,
  onClose,
  onConfirm,
  title = "Des-aprobar torneo",
  description,
  confirmLabel = "Des-aprobar",
  icon,
}: {
  tournament: { id: string; label?: string } | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  icon?: React.ReactNode;
}) {
  const open = !!tournament;
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const tooShort = reason.trim().length < 10;

  const handle = async () => {
    if (tooShort) {
      toast.error("El motivo debe tener al menos 10 caracteres");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon ?? <XCircle size={18} className="text-red-400" />} {title}
          </DialogTitle>
          <DialogDescription>
            {description
              ? tournament?.label
                ? `${tournament.label}. ${description}`
                : description
              : tournament?.label
                ? `${tournament.label}. Este torneo volverá a estado borrador y se notificará al organizador.`
                : "Este torneo volverá a estado borrador y se notificará al organizador."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs text-gray-400">
            Motivo (mínimo 10 caracteres)
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explica brevemente por qué se des-aprueba este torneo..."
            rows={4}
          />
          <div className="text-right text-xs text-gray-500">
            {reason.trim().length}/10
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handle}
            disabled={tooShort || saving}
            className="bg-red-500 hover:bg-red-500/90"
          >
            {saving ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : null}
            Des-aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
