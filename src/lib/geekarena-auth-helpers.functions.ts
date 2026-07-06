import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

export const resolveEmailByGeekTag = createServerFn({ method: "POST" })
  .inputValidator((d: { geek_tag: string }) =>
    z.object({ geek_tag: z.string().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getGeekarenaAdmin();
    const { data: player } = await admin
      .from("players")
      .select("email")
      .ilike("geek_tag", data.geek_tag)
      .maybeSingle();

    return { email: (player as any)?.email ?? null };
  });
