import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONE_PIECE_GAME_ID = "5b608762-d0a3-4a93-9739-e5cd150b01cd";
const EXCLUDED_SET_PREFIXES = ["OP01", "OP02", "OP03", "OP04"];

const ENDPOINTS = [
  "https://www.optcgapi.com/api/sets/filtered/?card_type=Leader",
  "https://www.optcgapi.com/api/decks/filtered/?card_type=Leader",
  "https://www.optcgapi.com/api/promos/filtered/?card_type=Leader",
];

function isExcluded(cardSetId: string): boolean {
  return EXCLUDED_SET_PREFIXES.some((prefix) => cardSetId.startsWith(prefix));
}

function deriveBaseName(cardName: string): string {
  return cardName.replace(/\s*\([^)]*\)/g, "").trim();
}

function parseColors(cardColor: string | null | undefined): string[] {
  if (!cardColor) return [];
  return cardColor.split(/\s+/).filter(Boolean);
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const seenCardSetIds = new Set<string>();
  const rowsToUpsert: Record<string, unknown>[] = [];

  try {
    for (const url of ENDPOINTS) {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`${url} respondió ${res.status}`);
      }
      const json = await res.json();
      const cards: any[] = Array.isArray(json) ? json : (json?.results ?? json?.data ?? []);
      console.log(`[sync] ${url} → ${cards.length} cards recibidas`);


      for (const card of cards) {
        const cardSetId: string | undefined = card.card_set_id;
        const cardName: string | undefined = card.card_name;
        if (!cardSetId || !cardName) continue;
        if (isExcluded(cardSetId)) continue;
        if (seenCardSetIds.has(cardSetId)) continue; // evitar duplicados entre endpoints
        seenCardSetIds.add(cardSetId);

        rowsToUpsert.push({
          game_id: ONE_PIECE_GAME_ID,
          identifier_type: "leader",
          source: "api",
          card_set_id: cardSetId,
          card_name: cardName,
          base_name: deriveBaseName(cardName),
          colors: parseColors(card.card_color),
          card_image: card.card_image ?? null,
          card_image_id: card.card_image_id ?? null,
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


    // Upsert masivo en batches de 200 para evitar payloads excesivos
    const BATCH_SIZE = 200;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
      const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from("deck_identifiers")
        .upsert(batch, { onConflict: "game_id,card_set_id" });
      if (error) throw new Error(`Upsert batch failed: ${error.message}`);
    }

    // Soft-delete: leaders activos en DB que ya no aparecieron en esta corrida
    const { data: activeRows, error: activeErr } = await admin
      .from("deck_identifiers")
      .select("id, card_set_id")
      .eq("game_id", ONE_PIECE_GAME_ID)
      .eq("source", "api")
      .eq("is_active", true);
    if (activeErr) throw new Error(`Fetch active rows failed: ${activeErr.message}`);

    const toDeactivate = (activeRows ?? [])
      .filter((r: any) => r.card_set_id && !seenCardSetIds.has(r.card_set_id))
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
