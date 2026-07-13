// Colores por juego/zona compartidos entre weekly-grid, admin.calendar y
// tcg-manager.calendar — antes vivían duplicados en cada archivo.
// ponytail: hardcodeado por slug/nombre; si se agregan juegos o zonas seguido,
// mover a una columna `color` en la tabla `games` (y una tabla de zonas) en vez
// de tocar este archivo cada vez.

export const GAME_COLORS: Record<string, string> = {
  "one-piece": "bg-orange-500/20 border-orange-500/40 text-orange-300",
  "magic-the-gathering": "bg-blue-500/20 border-blue-500/40 text-blue-300",
  pokemon: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
};
export const GAME_DOT_COLORS: Record<string, string> = {
  "one-piece": "bg-orange-400",
  "magic-the-gathering": "bg-blue-400",
  pokemon: "bg-yellow-400",
};
export const DEFAULT_COLOR_CLASS = "bg-[#32D9FF]/20 border-[#32D9FF]/40 text-[#32D9FF]";
export const DEFAULT_DOT_COLOR = "bg-[#32D9FF]";

export function colorClassForGame(slug: string) {
  return GAME_COLORS[slug] ?? DEFAULT_COLOR_CLASS;
}
export function dotColorForGame(slug: string) {
  return GAME_DOT_COLORS[slug] ?? DEFAULT_DOT_COLOR;
}

export type ZoneColor = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export const DEFAULT_ZONE = "Zona Extendida";

export const ZONE_COLORS: Record<string, ZoneColor> = {
  "Zona Monterrey": {
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    border: "border-orange-500/30",
    dot: "bg-orange-400",
  },
  "Zona Guadalajara": {
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
  },
  "Zona Centro": {
    bg: "bg-green-500/15",
    text: "text-green-300",
    border: "border-green-500/30",
    dot: "bg-green-400",
  },
  [DEFAULT_ZONE]: {
    bg: "bg-gray-500/15",
    text: "text-gray-300",
    border: "border-gray-500/30",
    dot: "bg-gray-400",
  },
};

export function colorsForZone(zone: string): ZoneColor {
  return ZONE_COLORS[zone] ?? ZONE_COLORS[DEFAULT_ZONE];
}
