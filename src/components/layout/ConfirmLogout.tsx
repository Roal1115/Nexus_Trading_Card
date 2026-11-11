import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Envuelve el botón de "Cerrar sesión" con una confirmación. Lo usan el
 * sidebar de escritorio (todos los roles) y el drawer móvil, así que cerrar
 * sesión nunca pasa con un solo clic accidental.
 */
export function ConfirmLogout({
  trigger,
  onConfirm,
}: {
  /** El botón que abre la confirmación (se usa como `asChild`). */
  trigger: React.ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">¿Cerrar sesión?</AlertDialogTitle>
          <AlertDialogDescription className="text-foreground-secondary">
            Tendrás que volver a iniciar sesión para ver tu ranking y registrar partidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={async (e) => {
              e.preventDefault();
              setPending(true);
              try {
                await onConfirm();
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Cerrando…" : "Cerrar sesión"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
