// reward_type es texto libre en el catálogo (~15 variantes: "Badge",
// "Animated Badge", "Seal + Frame + Title", "Title + Nameplate", ...).
// Esta es la ÚNICA fuente de verdad para "qué tipo(s) de reward otorga
// este achievement" — antes vivía como regex sueltas y duplicadas en
// achievements page (equipSlots) y en el filtro (getRewardCategory).
export type RewardKind = "title" | "badge" | "nameplate";

export function getRewardKinds(item: {
  reward_type?: string | null;
  title_text?: string | null;
}): RewardKind[] {
  const kinds: RewardKind[] = [];
  if (item.title_text) kinds.push("title");
  if (/badge/i.test(item.reward_type ?? "")) kinds.push("badge");
  if (/nameplate/i.test(item.reward_type ?? "")) kinds.push("nameplate");
  return kinds;
}

export const isNameplateReward = (item: { reward_type?: string | null }) =>
  /nameplate/i.test(item.reward_type ?? "");
