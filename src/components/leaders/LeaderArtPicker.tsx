import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Images, ShieldQuestion } from "lucide-react";
import { getDeckIdentifiers } from "@/lib/nexus-tournament-tracker.functions";
import {
  cleanLeaderName,
  type DeckIdentifier,
} from "@/components/tournament-tracker/round-ui";
import { InlineError } from "@/components/stores/store-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function LeaderArtPicker({
  gameId,
  leaderId,
  leaderName,
  cardSetId,
  selectedArtId,
  onSelect,
}: {
  gameId: string;
  leaderId: string;
  leaderName: string;
  cardSetId: string;
  selectedArtId?: string;
  onSelect: (art: DeckIdentifier) => void;
}) {
  const fetchLeaders = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<DeckIdentifier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(false);
    fetchLeaders({ data: { game_id: gameId, card_set_id: cardSetId } })
      .then((rows) => {
        if (active) setVariants(rows as DeckIdentifier[]);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, gameId, cardSetId, reload, fetchLeaders]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground-secondary transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Images size={14} /> Cambiar arte
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-border bg-popover text-popover-foreground">
        <DialogHeader>
          <DialogTitle>Arte de {cleanLeaderName(leaderName)}</DialogTitle>
          <DialogDescription>
            Solo cambia cómo se ve en tus estadísticas. Tus partidas no se modifican.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p role="status" className="py-10 text-center text-sm text-muted-foreground">
            Buscando versiones…
          </p>
        ) : error ? (
          <InlineError onRetry={() => setReload((value) => value + 1)}>
            No pudimos cargar las versiones.
          </InlineError>
        ) : variants.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No encontramos versiones de esta carta.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {variants.map((art) => {
              const selected = art.id === (selectedArtId ?? leaderId);
              return (
                <button
                  key={art.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onSelect(art);
                    setOpen(false);
                  }}
                  className="group min-w-0 text-left"
                >
                  <span
                    className={`relative block aspect-[5/7] overflow-hidden rounded-lg border bg-secondary transition ${
                      selected
                        ? "border-primary ring-1 ring-primary"
                        : "border-border group-hover:border-foreground-subtle"
                    }`}
                  >
                    {art.card_image ? (
                      <img
                        src={art.card_image}
                        alt={art.card_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <ShieldQuestion size={24} className="text-muted-foreground" />
                      </span>
                    )}
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={16} aria-label="Seleccionado" />
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block truncate font-mono text-xs text-muted-foreground">
                    {art.card_image_id ?? art.card_set_id}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
