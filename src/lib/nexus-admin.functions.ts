// Barrel: las server functions de admin viven divididas por sub-dominio.
// Los callers siguen importando de "@/lib/nexus-admin.functions".
export * from "./nexus-admin-shared";
export * from "./nexus-admin-tournaments.functions";
export * from "./nexus-admin-stores.functions";
export * from "./nexus-admin-players.functions";
export * from "./nexus-admin-meta.functions";
