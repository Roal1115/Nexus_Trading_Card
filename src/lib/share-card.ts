// Tarjeta PNG 1200x630 para compartir perfiles — mismo estilo visual que el
// downloadCard() de /players/$playerTag/season/$seasonId, pero reutilizable
// entre dashboard y el perfil público, y devuelta como File para adjuntarla
// al Web Share API en vez de solo compartir el link.
//
// Todo el camino hasta navigator.share() es SÍNCRONO a propósito: Safari
// exige que share() se llame dentro de la misma cadena de "user activation"
// del click — cualquier `await` antes (ej. cargar el avatar de forma
// asíncrona, o canvas.toBlob que es async) rompe esa cadena y Safari
// simplemente no hace nada, sin error visible. Por eso no cargamos avatar
// remoto aquí (requeriría esperar la carga de la imagen) y usamos
// canvas.toDataURL (síncrono) + un decode manual a Blob en vez de
// canvas.toBlob (asíncrono).
export type ShareCardData = {
  geekTag: string;
  subtitle?: string | null; // ciudad/tienda
  rankLabel?: string | null; // "#17"
  rankCaption?: string | null; // nombre de season/TCG bajo el rank
  statsLine?: string | null; // "78W · 17L · 82% WR"
  footerLine?: string | null; // "12/77 achievements" o similar
};

function generateShareCardDataUrl(data: ShareCardData): string {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0f1117");
  grad.addColorStop(1, "#131a2b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(232,106,34,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Avatar sintético (inicial) — nada de carga de imagen remota, ver nota arriba.
  const cx = W - 190;
  const cy = H / 2;
  const r = 110;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(232,106,34,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(232,106,34,0.5)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#e86a22";
  ctx.font = "bold 96px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.geekTag.charAt(0).toUpperCase(), cx, cy + 6);
  ctx.restore();
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#e86a22";
  ctx.font = "bold 26px Inter, sans-serif";
  ctx.fillText("TRADING CARD NEXUS", 70, 90);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px Inter, sans-serif";
  ctx.fillText(data.geekTag, 70, 190);

  if (data.subtitle) {
    ctx.fillStyle = "#7A8CAD";
    ctx.font = "600 28px Inter, sans-serif";
    ctx.fillText(data.subtitle, 70, 235);
  }

  let y = 340;
  if (data.rankLabel) {
    ctx.fillStyle = "#e86a22";
    ctx.font = "bold 96px 'JetBrains Mono', monospace";
    ctx.fillText(data.rankLabel, 70, y);
    if (data.rankCaption) {
      ctx.fillStyle = "#7A8CAD";
      ctx.font = "600 24px Inter, sans-serif";
      ctx.fillText(data.rankCaption.toUpperCase(), 70, y + 40);
    }
    y += 100;
  }

  if (data.statsLine) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px Inter, sans-serif";
    ctx.fillText(data.statsLine, 70, y);
    y += 55;
  }

  if (data.footerLine) {
    ctx.fillStyle = "#7A8CAD";
    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillText(data.footerLine, 70, y);
  }

  return canvas.toDataURL("image/png");
}

// atob/decode manual en vez de canvas.toBlob (async) — ver nota de arriba.
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Comparte el perfil con la tarjeta adjunta cuando el navegador soporta
// Web Share API Level 2 (files) — mobile Chrome/Safari, principalmente.
// Sin ese soporte (la mayoría de desktop), cae exactamente al comportamiento
// anterior: share de solo texto+link, y si tampoco hay Web Share, clipboard.
export async function shareProfileWithCard(opts: {
  url: string;
  title: string;
  text: string;
  cardData: ShareCardData;
  onCopied: () => void;
}): Promise<void> {
  const { url, title, text, cardData, onCopied } = opts;

  let file: File | null = null;
  try {
    const dataUrl = generateShareCardDataUrl(cardData);
    file = new File([dataUrlToBlob(dataUrl)], `${cardData.geekTag}-nexus.png`, {
      type: "image/png",
    });
  } catch {
    file = null;
  }

  const filesShareData = file ? { title, text, url, files: [file] } : null;

  try {
    if (filesShareData && navigator.canShare?.(filesShareData)) {
      await navigator.share(filesShareData);
      return;
    }
    if (navigator.share && navigator.canShare?.({ title, text, url })) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return; // usuario canceló, no es error
  }

  await copyTextFallback(url);
  onCopied();
}

// navigator.clipboard solo existe en contexto seguro (HTTPS, o localhost en
// el MISMO dispositivo) — probar la app desde el celular vía la IP local de
// la red (http://192.168.x.x:puerto) NO cuenta como seguro, así que tanto
// navigator.share como navigator.clipboard quedan undefined ahí y esta
// llamada tiraba una excepción sin capturar (silenciosa: "no pasa nada").
// document.execCommand("copy") es viejo pero no tiene ese requisito.
async function copyTextFallback(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // sigue al fallback de abajo
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
