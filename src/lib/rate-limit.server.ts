// Rate limiting en memoria por IP para server functions.
// ponytail: ventana fija en memoria del worker — se resetea si el isolate
// se recicla y no se comparte entre isolates. Suficiente contra brute force
// casual; si algún día hay dashboard de Cloudflare propio, migrar a WAF rules.
import { getRequest } from "@tanstack/react-start/server";

const buckets = new Map<string, { count: number; windowStart: number }>();

export function getClientIp(): string {
  const req = getRequest();
  return (
    req?.headers.get("cf-connecting-ip") ??
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// true si la llamada está DENTRO del límite; false si debe rechazarse.
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now - b.windowStart > windowMs) buckets.delete(k);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}
