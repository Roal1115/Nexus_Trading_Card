// Tarjeta PNG 1080x1350 para compartir perfiles — mismo estilo visual que el
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
  nexusTag: string;
  subtitle?: string | null; // ciudad/tienda
  rankLabel?: string | null; // "#17"
  rankCaption?: string | null; // nombre de season/TCG bajo el rank
  statsLine?: string | null; // "78W · 17L · 82% WR"
  footerLine?: string | null; // "12/77 achievements" o similar
  badge?: string | null; // título equipado
  stats?: { label: string; value: string }[];
  leaderName?: string | null;
  recentPlacements?: number[]; // cronológico, izquierda a derecha
};

const CARD_FONT = "'Space Grotesk', Inter, sans-serif";
const CARD_MONO = "'JetBrains Mono', monospace";
const INK = "#f5f7fa";
const MUTED = "#aab6d1";
const ACCENT = "#32d9ff";

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Baja el tamaño hasta que quepa: un tag puede tener hasta 30 caracteres. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
) {
  let size = start;
  ctx.font = `bold ${size}px ${CARD_FONT}`;
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `bold ${size}px ${CARD_FONT}`;
  }
  return size;
}

function clipText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export function generateShareCardDataUrl(data: ShareCardData): string {
  const W = 1080;
  const H = 1350;
  const M = 80;
  const inner = W - M * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#08111f");
  bg.addColorStop(0.55, "#111a2e");
  bg.addColorStop(1, "#1c1540");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 760);
  glow.addColorStop(0, "rgba(50,217,255,0.22)");
  glow.addColorStop(1, "rgba(50,217,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 12);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `bold 46px ${CARD_FONT}`;
  ctx.fillText("TCG LEAGUE", M, 130);
  ctx.fillStyle = MUTED;
  ctx.font = `600 26px ${CARD_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("TARJETA DE JUGADOR", W - M, 128);
  ctx.textAlign = "left";

  let y = 320;
  const tagSize = fitFont(ctx, data.nexusTag, inner, 132, 56);
  ctx.fillStyle = INK;
  ctx.fillText(data.nexusTag, M, y);
  y += Math.max(56, Math.round(tagSize * 0.55));

  const line = [data.badge, data.subtitle].filter(Boolean).join("  ·  ");
  if (line) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 34px ${CARD_FONT}`;
    ctx.fillText(clipText(ctx, line, inner), M, y);
  }

  y = 640;
  if (data.rankLabel) {
    ctx.fillStyle = ACCENT;
    ctx.font = `bold 200px ${CARD_MONO}`;
    ctx.fillText(data.rankLabel, M - 8, y);
    ctx.fillStyle = MUTED;
    ctx.font = `600 30px ${CARD_FONT}`;
    ctx.fillText(
      clipText(
        ctx,
        ["RANKING", data.rankCaption?.toUpperCase()].filter(Boolean).join(" · "),
        inner,
      ),
      M,
      y + 56,
    );
  } else if (data.statsLine) {
    ctx.fillStyle = INK;
    ctx.font = `bold 72px ${CARD_FONT}`;
    ctx.fillText(clipText(ctx, data.statsLine, inner), M, y);
  }

  const stats = (data.stats ?? []).slice(0, 3);
  if (stats.length > 0) {
    const gap = 20;
    const cardW = (inner - gap * (stats.length - 1)) / stats.length;
    stats.forEach((stat, i) => {
      const x = M + i * (cardW + gap);
      roundedRect(ctx, x, 770, cardW, 176, 16);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = `600 26px ${CARD_FONT}`;
      ctx.fillText(stat.label.toUpperCase(), x + 28, 828);
      ctx.fillStyle = INK;
      ctx.font = `bold 66px ${CARD_MONO}`;
      ctx.fillText(clipText(ctx, stat.value, cardW - 56), x + 28, 908);
    });
  }

  y = 1030;
  if (data.leaderName) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 26px ${CARD_FONT}`;
    ctx.fillText("LEADER PRINCIPAL", M, y);
    ctx.fillStyle = INK;
    ctx.font = `bold 46px ${CARD_FONT}`;
    ctx.fillText(clipText(ctx, data.leaderName, inner), M, y + 58);
  }

  const recent = (data.recentPlacements ?? []).slice(-5);
  if (recent.length > 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 26px ${CARD_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText("ÚLTIMOS RESULTADOS", W - M, y);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = 64;
    recent.forEach((place, i) => {
      const cx = W - M - size / 2 - (recent.length - 1 - i) * (size + 12);
      ctx.beginPath();
      ctx.arc(cx, y + 58, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = place <= 3 ? ACCENT : "rgba(255,255,255,0.12)";
      ctx.fill();
      ctx.fillStyle = place <= 3 ? "#08111f" : INK;
      ctx.font = `bold 26px ${CARD_MONO}`;
      ctx.fillText(String(place), cx, y + 60);
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, 1210);
  ctx.lineTo(W - M, 1210);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `600 26px ${CARD_FONT}`;
  if (data.footerLine) ctx.fillText(clipText(ctx, data.footerLine, inner), M, 1262);
  ctx.font = `500 22px ${CARD_FONT}`;
  ctx.fillText("Comunidad independiente, sin afiliación con Bandai.", M, 1302);

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
    file = new File([dataUrlToBlob(dataUrl)], `${cardData.nexusTag}-tcg-league.png`, {
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
