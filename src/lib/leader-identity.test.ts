import { describe, expect, it } from "vitest";
import { createLeaderIdentityResolver } from "./leader-identity";

const arts = [
  { id: "arte-a", card_set_id: "OP01-001", card_image_id: "OP01-001", canonical_leader_id: null },
  { id: "arte-b", card_set_id: "OP01-001", card_image_id: "OP01-001_p1", canonical_leader_id: null },
];

describe("identidad estadística de líderes", () => {
  it("junta las artes del líder propio aunque no tengan canonical asignado", () => {
    const { resolveId } = createLeaderIdentityResolver(arts);
    expect(new Set(arts.map((art) => resolveId(art.id))).size).toBe(1);
  });

  it("junta las artes del líder oponente en un solo matchup", () => {
    const { resolveId } = createLeaderIdentityResolver(arts);
    const matchups = new Map<string, number>();
    for (const art of arts) {
      const id = resolveId(art.id);
      matchups.set(id, (matchups.get(id) ?? 0) + 1);
    }
    expect(Array.from(matchups.values())).toEqual([2]);
  });

  it("respeta el canonical compartido cuando existe", () => {
    const rows = arts.map((art) => ({ ...art, canonical_leader_id: "canonico" }));
    const { resolveId } = createLeaderIdentityResolver(rows);
    expect(resolveId("arte-a")).toBe("canonico");
    expect(resolveId("arte-b")).toBe("canonico");
  });

  it("no mezcla líderes con card_set_id distinto", () => {
    const { resolveId } = createLeaderIdentityResolver([
      arts[0],
      { ...arts[1], card_set_id: "OP01-002" },
    ]);
    expect(resolveId("arte-a")).not.toBe(resolveId("arte-b"));
  });
});
