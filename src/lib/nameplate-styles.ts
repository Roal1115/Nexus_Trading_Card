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
    gradient: "from-tier-bronze/50 via-tier-bronze/20 to-transparent",
    border: "border-tier-bronze/50",
    icon: "text-tier-bronze bg-tier-bronze/40 border-tier-bronze/50",
    text: "text-tier-bronze",
    glow: "shadow-[0_0_24px_-8px_var(--tier-bronze)]",
    button: "border-tier-bronze/50 bg-tier-bronze/15 text-tier-bronze sm:hover:bg-tier-bronze/25",
  },
  Silver: {
    gradient: "from-tier-silver/50 via-tier-silver/15 to-transparent",
    border: "border-tier-silver/50",
    icon: "text-tier-silver bg-tier-silver/30 border-tier-silver/50",
    text: "text-tier-silver",
    glow: "shadow-[0_0_24px_-8px_var(--tier-silver)]",
    button: "border-tier-silver/50 bg-tier-silver/15 text-tier-silver sm:hover:bg-tier-silver/25",
  },
  Gold: {
    gradient: "from-tier-gold/50 via-tier-gold/15 to-transparent",
    border: "border-tier-gold/50",
    icon: "text-tier-gold bg-tier-gold/30 border-tier-gold/50",
    text: "text-tier-gold",
    glow: "shadow-[0_0_24px_-8px_var(--tier-gold)]",
    button: "border-tier-gold/50 bg-tier-gold/15 text-tier-gold sm:hover:bg-tier-gold/25",
  },
  Platinum: {
    gradient: "from-tier-platinum/50 via-tier-platinum/15 to-transparent",
    border: "border-tier-platinum/50",
    icon: "text-tier-platinum bg-tier-platinum/30 border-tier-platinum/50",
    text: "text-tier-platinum",
    glow: "shadow-[0_0_24px_-8px_var(--tier-platinum)]",
    button: "border-tier-platinum/50 bg-tier-platinum/15 text-tier-platinum sm:hover:bg-tier-platinum/25",
  },
  Legacy: {
    gradient: "from-tier-legacy/50 via-tier-legacy/15 to-transparent",
    border: "border-tier-legacy/50",
    icon: "text-tier-legacy bg-tier-legacy/30 border-tier-legacy/50",
    text: "text-tier-legacy",
    glow: "shadow-[0_0_24px_-8px_var(--tier-legacy)]",
    button: "border-tier-legacy/50 bg-tier-legacy/15 text-tier-legacy sm:hover:bg-tier-legacy/25",
  },
  "Road Bonus": {
    gradient: "from-primary/50 via-primary/15 to-transparent",
    border: "border-primary/50",
    icon: "text-primary bg-primary/30 border-primary/50",
    text: "text-primary",
    glow: "shadow-[0_0_24px_-8px_var(--primary)]",
    button: "border-primary/50 bg-primary/15 text-primary sm:hover:bg-primary/25",
  },
};
export const DEFAULT_NAMEPLATE_BANNER = NAMEPLATE_BANNER_STYLES.Silver;
