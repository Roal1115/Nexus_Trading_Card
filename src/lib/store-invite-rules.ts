export const INVITE_DAYS = 7;

/** Base del Nexus Tag de una tienda: solo letras y números, sin acentos. */
export function storeTagBase(storeName: string): string {
  const clean = storeName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 24);
  return clean.length >= 3 ? clean : `Tienda${clean}`;
}

/** El token viaja en el enlace; en la base solo se guarda su hash. */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
