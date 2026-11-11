// Barrel: server functions de manager divididas por sub-dominio.
// Los callers siguen importando de "@/lib/nexus-manager.functions".
export * from "./nexus-manager-shared";
export * from "./nexus-manager-tournaments.functions";
export * from "./nexus-manager-calendar.functions";
export * from "./nexus-manager-stores.functions";
export * from "./nexus-manager-history.functions";
export * from "./nexus-manager-analytics.functions";
