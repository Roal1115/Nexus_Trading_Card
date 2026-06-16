import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONE_PIECE_GAME_ID = "5b608762-d0a3-4a93-9739-e5cd150b01cd";
const EXCLUDED_SET_PREFIXES = ["OP01", "OP02", "OP03", "OP04"];

const ENDPOINTS = [
  { url: "https://www.optcgapi.com/api/sets/filtered/?card_type=Leader", source: "set" },
  { url: "https://www.optcgapi.com/api/decks/filtered/?card_type=Leader", source: "deck" },
  { url: "https://www.optcgapi.com/api/promos/filtered/?card_type=Leader", source: "promo" },
];

function isExcluded(cardSetId: string): boolean {
  return EXCLUDED_SET_PREFIXES.some((prefix) => cardSetId.startsWith(prefix));
}

function deriveBaseName(cardName: string): string {
  // Quita todo lo que esté entre paréntesis, ej. "Rebecca (039) (Alternate Art)" -> "Rebecca"
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

  let added = 0;
  let updated = 0;
  let deactivated = 0;
  const seenCardSetIds = new Set<string>();

  try {
    for (const endpoint of ENDPOINTS) {
      const res = await fetch(endpoint.url);
      if (!res.ok) {
        throw new Error(`${endpoint.url} respondió ${res.status}`);
      }
      const json = await res.json();
      // La API puede regresar un array directo o un objeto paginado {results: [...]}.
      // Manejar ambos casos defensivamente.
      const cards: any[] = Array.isArray(json) ? json : (json?.results ?? json?.data ?? []);

      for (const card of cards) {
        const cardSetId: string | undefined = card.card_set_id;
        const cardName: string | undefined = card.card_name;
        if (!cardSetId || !cardName) continue;
        if (isExcluded(cardSetId)) continue;

        seenCardSetIds.add(cardSetId);

        const baseName = deriveBaseName(cardName);
        const colors = parseColors(card.card_color);

        const row = {
          game_id: ONE_PIECE_GAME_ID,
          identifier_type: "leader" as const,
          source: "api" as const,
          card_set_id: cardSetId,
          card_name: cardName,
          base_name: baseName,
          colors,
          card_image: card.card_image ?? null,
          card_image_id: card.card_image_id ?? null,
          set_code: card.set_id ?? null,
          set_name: card.set_name ?? null,
          rarity: card.rarity ?? null,
          is_active: true,
          synced_at: new Date().toISOString(),
        };

        const { data: existing } = await admin
          .from("deck_identifiers")
          .select("id")
          .eq("game_id", ONE_PIECE_GAME_ID)
          .eq("card_set_id", cardSetId)
          .maybeSingle();

        if (existing) {
          const { error } = await admin
            .from("deck_identifiers")
            .update(row)
            .eq("id", existing.id);
          if (error) throw new Error(`Update failed for ${cardSetId}: ${error.message}`);
          updated++;
        } else {
          const { error } = await admin.from("deck_identifiers").insert(row);
          if (error) throw new Error(`Insert failed for ${cardSetId}: ${error.message}`);
          added++;
        }
      }
    }

    // Soft-delete: cualquier leader que ya estaba activo pero no apareció en esta corrida
    const { data: activeRows } = await admin
      .from("deck_identifiers")
      .select("id, card_set_id")
      .eq("game_id", ONE_PIECE_GAME_ID)
      .eq("source", "api")
      .eq("is_active", true);

    const toDeactivate = (activeRows ?? [])
      .filter((r: any) => r.card_set_id && !seenCardSetIds.has(r.card_set_id))
      .map((r: any) => r.id);

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
      leaders_added: added,
      leaders_updated: updated,
      leaders_deactivated: deactivated,
      status: "success",
    });

    return new Response(
      JSON.stringify({ ok: true, added, updated, deactivated }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    await admin.from("deck_identifiers_sync_log").insert({
      game_id: ONE_PIECE_GAME_ID,
      leaders_added: added,
      leaders_updated: updated,
      leaders_deactivated: deactivated,
      status: "error",
      error_message: String((err as Error).message ?? err),
    });
    return new Response(
      JSON.stringify({ ok: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
