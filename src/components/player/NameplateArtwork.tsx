import { useId } from "react";

// Config de diseño por tier — la única fuente que hay que tocar para sumar
// un tier nuevo o, en el futuro, un override por achievement key
// (NAMEPLATE_DESIGNS[key] ?? NAMEPLATE_TIER_ART[tier]) sin reescribir el SVG.
type NameplateArt = {
  base: string; // fondo oscuro de la placa
  primary: string; // metal principal (bordes, ornamentos)
  secondary: string; // metal secundario (sombras del bisel)
  glow: string; // color del resplandor exterior
};

export const NAMEPLATE_TIER_ART: Record<string, NameplateArt> = {
  Bronze: { base: "#1a1108", primary: "#d97706", secondary: "#78350f", glow: "rgba(217,119,6,0.55)" },
  Silver: { base: "#12151a", primary: "#cbd5e1", secondary: "#64748b", glow: "rgba(203,213,225,0.5)" },
  Gold: { base: "#1a1608", primary: "#eab308", secondary: "#854d0e", glow: "rgba(234,179,8,0.55)" },
  Platinum: { base: "#071a1f", primary: "#22d3ee", secondary: "#0e7490", glow: "rgba(34,211,238,0.6)" },
  Legacy: { base: "#1a0a1c", primary: "#e879f9", secondary: "#86198f", glow: "rgba(232,121,249,0.6)" },
  "Road Bonus": { base: "#170f05", primary: "var(--primary, #e86a22)", secondary: "#7c3d10", glow: "rgba(232,106,34,0.55)" },
};
export const DEFAULT_NAMEPLATE_ART = NAMEPLATE_TIER_ART.Silver;

// Endcap: punta con corte angular hexagonal, sin ornamento adicional
// adentro — solo el marco metálico. Se dibuja una sola vez y se espeja en
// CSS (scaleX(-1)) para el lado derecho.
function Endcap({ art, gradId }: { art: NameplateArt; gradId: string }) {
  return (
    <svg viewBox="0 0 18 64" className="h-full w-[18px] flex-shrink-0" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${gradId}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={art.primary} stopOpacity="0.95" />
          <stop offset="50%" stopColor={art.secondary} stopOpacity="0.9" />
          <stop offset="100%" stopColor={art.primary} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Punta angosta — solo un remate visual, sin hueco oscuro vacío
          compitiendo con el texto (antes era casi el doble de ancho y se
          leía como un espacio muerto al costado de la palabra). */}
      <path
        d="M18 4 L8 4 L2 32 L8 60 L18 60 Z"
        fill={art.base}
        stroke={`url(#${gradId}-metal)`}
        strokeWidth="2"
      />
    </svg>
  );
}

// Barra central: se estira con flex-1 (preserveAspectRatio="none") porque
// es simétrica — un gradiente + dos líneas de bisel no se distorsionan al
// estirarse, a diferencia de un ornamento con detalle fino.
function MiddleBar({ art, gradId }: { art: NameplateArt; gradId: string }) {
  return (
    <svg
      viewBox="0 0 200 64"
      preserveAspectRatio="none"
      className="h-full w-full flex-1"
    >
      <defs>
        <linearGradient id={`${gradId}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={art.secondary} stopOpacity="0.5" />
          <stop offset="50%" stopColor={art.secondary} stopOpacity="0" />
          <stop offset="100%" stopColor={art.secondary} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${gradId}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={art.primary} stopOpacity="0" />
          <stop offset="50%" stopColor={art.primary} stopOpacity="0.08" />
          <stop offset="100%" stopColor={art.primary} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Base opaca sólida + tinte/sheen sutiles encima. A esta altura
          (~50px) el bisel y el texto ya ocupan buena parte del alto, así
          que el bisel queda fino y de baja opacidad para que la placa siga
          leyéndose oscura, no como un borde brillante compitiendo con el
          texto. */}
      <rect x="0" y="4" width="200" height="56" fill={art.base} />
      <rect x="0" y="4" width="200" height="56" fill={`url(#${gradId}-edge)`} />
      <rect x="0" y="4" width="200" height="56" fill={`url(#${gradId}-sheen)`} />
      {/* Bisel: borde superior e inferior metálico, fino y sutil */}
      <line x1="0" y1="5" x2="200" y2="5" stroke={art.primary} strokeWidth="1" opacity="0.55" />
      <line x1="0" y1="59" x2="200" y2="59" stroke={art.primary} strokeWidth="1" opacity="0.55" />
    </svg>
  );
}

// Placa completa: endcap + barra estirable + endcap espejado. El nombre y
// el ícono NUNCA se dibujan acá — los superpone NameplateBanner en HTML.
export function NameplateArtwork({ tier }: { tier: string }) {
  const art = NAMEPLATE_TIER_ART[tier] ?? DEFAULT_NAMEPLATE_ART;
  const gradId = useId();
  return (
    <div
      className="absolute inset-0 flex items-stretch overflow-hidden rounded-md"
      style={{ filter: `drop-shadow(0 0 8px ${art.glow})` }}
      aria-hidden="true"
    >
      <Endcap art={art} gradId={gradId} />
      <MiddleBar art={art} gradId={gradId} />
      <div className="flex-shrink-0 scale-x-[-1]">
        <Endcap art={art} gradId={`${gradId}-r`} />
      </div>
    </div>
  );
}
