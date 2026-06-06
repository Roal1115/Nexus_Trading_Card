import { createServerFn } from "@tanstack/react-start";
import { getGeekarenaAdmin } from "./geekarena-admin.server";
import { requireGeekarenaAdmin } from "./geekarena-auth.middleware";

type SeedAccount = {
  email: string;
  password: string;
  geek_tag: string;
  role: "admin" | "organizer" | "player";
  display_name: string;
};

const ACCOUNTS: SeedAccount[] = [
  {
    email: "admin@test.com",
    password: "test1234",
    geek_tag: "AdminGeek",
    role: "admin",
    display_name: "Administrador",
  },
  {
    email: "organizer@test.com",
    password: "test1234",
    geek_tag: "OrgGeek",
    role: "organizer",
    display_name: "Organizador",
  },
];

export const seedTestAccounts = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .handler(async () => {
    // Only callable by an authenticated admin (enforced by middleware).
    // Additionally restrict to non-production environments to prevent
    // accidental reset of canonical test-account passwords in prod.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Esta operación está deshabilitada en producción.");
    }
    const admin = getGeekarenaAdmin();
    const results: Array<{ email: string; ok: boolean; message: string }> = [];

    for (const acc of ACCOUNTS) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) {
        results.push({ email: acc.email, ok: false, message: listErr.message });
        continue;
      }
      let user = list.users.find(
        (u) => u.email?.toLowerCase() === acc.email.toLowerCase(),
      );

      if (!user) {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email: acc.email,
            password: acc.password,
            email_confirm: true,
            user_metadata: { geek_tag: acc.geek_tag },
          });
        if (createErr || !created?.user) {
          results.push({
            email: acc.email,
            ok: false,
            message: createErr?.message ?? "No se pudo crear el usuario",
          });
          continue;
        }
        user = created.user;
      } else {
        await admin.auth.admin.updateUserById(user.id, {
          password: acc.password,
          email_confirm: true,
        });
      }

      const { error: upsertErr } = await admin
        .from("players")
        .upsert(
          {
            email: acc.email,
            geek_tag: acc.geek_tag,
            display_name: acc.display_name,
            role: acc.role,
            is_active: true,
          },
          { onConflict: "email" },
        );
      if (upsertErr) {
        results.push({
          email: acc.email,
          ok: false,
          message: `Auth ok, players falló: ${upsertErr.message}`,
        });
        continue;
      }

      results.push({
        email: acc.email,
        ok: true,
        message: `Listo (${acc.role})`,
      });
    }

    return { results };
  });
