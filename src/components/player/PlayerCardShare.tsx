import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  generateShareCardDataUrl,
  shareProfileWithCard,
  type ShareCardData,
} from "@/lib/share-card";

/** Botón "Mi tarjeta": vista previa de la tarjeta del jugador, descarga y compartir. */
export function PlayerCardShare({
  url,
  title,
  text,
  cardData,
  className,
}: {
  url: string;
  title: string;
  text: string;
  cardData: ShareCardData;
  className?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPreview(generateShareCardDataUrl(cardData))}
        className={className}
      >
        <Share2 size={12} /> Tarjeta de jugador
      </button>
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tarjeta de jugador</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <img
                src={preview}
                alt={`Tarjeta de ${cardData.nexusTag}`}
                className="w-full rounded-xl"
              />
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={preview}
                  download={`${cardData.nexusTag}-tcg-league.png`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition hover:bg-white/5"
                >
                  <Download size={15} /> Descargar
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void shareProfileWithCard({
                      url,
                      title,
                      text,
                      cardData,
                      onCopied: () => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      },
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Share2 size={15} /> {copied ? "¡Link copiado!" : "Compartir"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
