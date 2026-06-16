import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONE_PIECE_GAME_ID = "5b608762-d0a3-4a93-9739-e5cd150b01cd";
const EXCLUDED_SET_PREFIXES = ["OP01", "OP02", "OP03", "OP04"];

const ENDPOINTS: { url: string; source: "set" | "deck" | "promo" }[] = [
  { url: "https://www.optcgapi.com/api/sets/filtered/?card_type=Leader", source: "set" },
  { url: "https://www.optcgapi.com/api/decks/filtered/?card_type=Leader", source: "deck" },
  { url: "https://www.optcgapi.com/api/promos/filtered/?card_type=Leader", source: "promo" },
];

function isExcluded(cardSetId: string): boolean {
  return EXCLUDED_SET_PREFIXES.some((prefix) => cardSetId.startsWith(prefix));
}

function deriveBaseName(cardName: string): string {
  return cardName
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*-\s*[A-Z]{1,4}\d{1,3}-\d{1,3}\s*$/g, "")
    .trim();
}

function parseColors(cardColor: string | null | undefined): string[] {
  if (!cardColor) return [];
  return cardColor.split(/\s+/).filter(Boolean);
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Clave de dedup ahora es (api_source, card_image_id) — único POR endpoint
  const seenKeys = new Set<string>();
  const rowsToUpsert: Record<string, unknown>[] = [];

  try {
    for (const endpoint of ENDPOINTS) {
      const res = await fetch(endpoint.url);
      if (!res.ok) {
        throw new Error(`${endpoint.url} respondió ${res.status}`);
      }
      const json = await res.json();
      const cards: any[] = Array.isArray(json) ? json : (json?.results ?? json?.data ?? []);
      console.log(`[sync] ${endpoint.url} → ${cards.length} cards recibidas`);

      for (const card of cards) {
        const cardSetId: string | undefined = card.card_set_id;
        const cardName: string | undefined = card.card_name;
        const cardImageId: string | undefined = card.card_image_id ?? cardSetId;
        if (!cardSetId || !cardName || !cardImageId) continue;
        if (isExcluded(cardSetId)) continue;

        const dedupKey = `${endpoint.source}:${cardImageId}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        rowsToUpsert.push({
          game_id: ONE_PIECE_GAME_ID,
          identifier_type: "leader",
          source: "api",
          api_source: endpoint.source,
          card_set_id: cardSetId,
          card_name: cardName,
          base_name: deriveBaseName(cardName),
          colors: parseColors(card.card_color),
          card_image: card.card_image ?? null,
          card_image_id: cardImageId,
          set_code: card.set_id ?? null,
          set_name: card.set_name ?? null,
          rarity: card.rarity ?? null,
          is_active: true,
          synced_at: new Date().toISOString(),
        });
      }
    }

    console.log(`[sync] total rowsToUpsert antes de upsert: ${rowsToUpsert.length}`);

    if (rowsToUpsert.length === 0) {
      throw new Error("No se recibieron leaders válidos de ninguna fuente");
    }

    const BATCH_SIZE = 200;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
      const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from("deck_identifiers")
        .upsert(batch, { onConflict: "game_id,card_image_id,api_source" });
      if (error) throw new Error(`Upsert batch failed: ${error.message}`);
    }

    // Soft-delete: filas activas que ya no aparecieron en esta corrida
    const { data: activeRows, error: activeErr } = await admin
      .from("deck_identifiers")
      .select("id, card_image_id, api_source")
      .eq("game_id", ONE_PIECE_GAME_ID)
      .eq("source", "api")
      .eq("is_active", true);
    if (activeErr) throw new Error(`Fetch active rows failed: ${activeErr.message}`);

    const toDeactivate = (activeRows ?? [])
      .filter((r: any) => !seenKeys.has(`${r.api_source}:${r.card_image_id}`))
      .map((r: any) => r.id);

    let deactivated = 0;
    if (toDeactivate.length > 0) {
      const { error } = await admin
        .from("deck_identifiers")
        .update({ is_active: false })
        .in("id", toDeactivate);
      if (error) throw new Error(`Deactivate failed: ${error.message}`);
      deactivated = toDeactivate.length;
    }

    await admin.from("deck_identifiers_sync_log").insert({
      game_id: ONE_PIECE_GAME_ID,
      leaders_added: rowsToUpsert.length,
      leaders_updated: 0,
      leaders_deactivated: deactivated,
      status: "success",
    });

    return new Response(
      JSON.stringify({ ok: true, total_processed: rowsToUpsert.length, deactivated }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    await admin.from("deck_identifiers_sync_log").insert({
      game_id: ONE_PIECE_GAME_ID,
      leaders_added: 0,
      leaders_updated: 0,
      leaders_deactivated: 0,
      status: "error",
      error_message: String((err as Error).message ?? err),
    });
    return new Response(
      JSON.stringify({ ok: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
