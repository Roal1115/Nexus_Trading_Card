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

type ZoneOption = { name: string; subzones: { name: string }[] };

/** null es "No sé". Una subzona debe ser de la zona elegida. */
export function subzoneIsValid(
  zones: ZoneOption[],
  zone: string | null,
  subzone: string | null,
): boolean {
  if (subzone === null) return true;
  return Boolean(zones.find((z) => z.name === zone)?.subzones.some((s) => s.name === subzone));
}

/** Enlace compartido desde Google Maps, largo o corto. */
export function isGoogleMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "maps.app.goo.gl" || host === "maps.google.com") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  return /^google\.[a-z.]{2,8}$/.test(host) && url.pathname.startsWith("/maps");
}

/** El token viaja en el enlace; en la base solo se guarda su hash. */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function inviteKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** AES-GCM: `iv.cifrado` en base64. El secreto vive solo en el servidor. */
export async function encryptInviteToken(token: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await inviteKey(secret),
    new TextEncoder().encode(token),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(data))}`;
}

export async function decryptInviteToken(stored: string, secret: string): Promise<string> {
  const [iv, data] = stored.split(".");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    await inviteKey(secret),
    fromBase64(data),
  );
  return new TextDecoder().decode(plain);
}

export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
