// Nameplate = una franja/emblema, no una card de texto plana ni un pill —
// banner con gradiente + glow + ícono genérico por tier (sin arte custom
// todavía). Fuente única compartida entre el hub de achievements y el Hero
// del perfil — antes el perfil tenía su propio mapa de rail plano
// (NAMEPLATE_TIER_STYLES) que competía con este.
export const NAMEPLATE_BANNER_STYLES: Record<
  string,
  { gradient: string; border: string; icon: string; text: string; glow: string; button: string }
> = {
  Bronze: {
    gradient: "from-amber-900/50 via-amber-800/20 to-transparent",
    border: "border-amber-600/50",
    icon: "text-amber-400 bg-amber-900/40 border-amber-600/50",
    text: "text-amber-300",
    glow: "shadow-[0_0_24px_-8px_rgba(180,83,9,0.7)]",
    button: "border-amber-500/50 bg-amber-500/15 text-amber-300 sm:hover:bg-amber-500/25",
  },
  Silver: {
    gradient: "from-gray-500/50 via-gray-500/15 to-transparent",
    border: "border-gray-400/50",
    icon: "text-gray-200 bg-gray-500/30 border-gray-400/50",
    text: "text-gray-200",
    glow: "shadow-[0_0_24px_-8px_rgba(156,163,175,0.7)]",
    button: "border-gray-300/50 bg-gray-300/15 text-gray-200 sm:hover:bg-gray-300/25",
  },
  Gold: {
    gradient: "from-yellow-600/50 via-yellow-600/15 to-transparent",
    border: "border-yellow-500/50",
    icon: "text-yellow-300 bg-yellow-600/30 border-yellow-500/50",
    text: "text-yellow-300",
    glow: "shadow-[0_0_24px_-8px_rgba(234,179,8,0.7)]",
    button: "border-yellow-400/50 bg-yellow-400/15 text-yellow-300 sm:hover:bg-yellow-400/25",
  },
  Platinum: {
    gradient: "from-cyan-600/50 via-cyan-600/15 to-transparent",
    border: "border-cyan-400/50",
    icon: "text-cyan-300 bg-cyan-600/30 border-cyan-400/50",
    text: "text-cyan-300",
    glow: "shadow-[0_0_24px_-8px_rgba(34,211,238,0.7)]",
    button: "border-cyan-300/50 bg-cyan-300/15 text-cyan-300 sm:hover:bg-cyan-300/25",
  },
  Legacy: {
    gradient: "from-fuchsia-700/50 via-fuchsia-700/15 to-transparent",
    border: "border-fuchsia-500/50",
    icon: "text-fuchsia-300 bg-fuchsia-700/30 border-fuchsia-500/50",
    text: "text-fuchsia-300",
    glow: "shadow-[0_0_24px_-8px_rgba(217,70,239,0.7)]",
    button: "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-300 sm:hover:bg-fuchsia-400/25",
  },
  "Road Bonus": {
    gradient: "from-primary/50 via-primary/15 to-transparent",
    border: "border-primary/50",
    icon: "text-primary bg-primary/30 border-primary/50",
    text: "text-primary",
    glow: "shadow-[0_0_24px_-8px_rgba(232,106,34,0.7)]",
    button: "border-primary/50 bg-primary/15 text-primary sm:hover:bg-primary/25",
  },
};
export const DEFAULT_NAMEPLATE_BANNER = NAMEPLATE_BANNER_STYLES.Silver;
