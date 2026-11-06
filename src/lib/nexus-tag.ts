// Una sola regla para el registro y Configuración. Los tags viejos que no la cumplen
// siguen funcionando: solo se valida al crear o cambiar un tag.
export const TAG_RE = /^[A-Za-z0-9_]{3,30}$/;
export const TAG_RULE_MESSAGE = "3 a 30 caracteres. Solo letras, números y guiones bajos";
