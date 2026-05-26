import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { seedTestAccounts } from "@/lib/geekarena-setup.functions";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useGeekarenaRole();

  if (roleLoading) return null;
  if (role !== "admin") {
    router.navigate({ to: "/login" });
    return null;
  }

  const run = useServerFn(seedTestAccounts);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<
    Array<{ email: string; ok: boolean; message: string }> | null
  >(null);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const res = await run();
      setResults(res.results);
    } catch (e) {
      setResults([{ email: "-", ok: false, message: String(e) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 max-w-lg w-full space-y-4">
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 rounded-lg p-3 text-sm font-medium">
          ⚠️ Esta página es solo para desarrollo. No la uses en producción.
        </div>
        <h1 className="text-2xl font-bold">Configuración inicial</h1>
        <p className="text-muted-foreground text-sm">
          Crea las cuentas de prueba <code>admin@test.com</code> y{" "}
          <code>organizer@test.com</code> (contraseña <code>test1234</code>) y
          asigna sus roles en la tabla <code>players</code>.
        </p>
        <Button onClick={handleSeed} disabled={loading} className="w-full">
          {loading ? "Creando cuentas..." : "Crear cuentas de prueba"}
        </Button>
        {results && (
          <ul className="space-y-2 text-sm">
            {results.map((r) => (
              <li
                key={r.email}
                className={r.ok ? "text-green-500" : "text-red-500"}
              >
                <strong>{r.email}:</strong> {r.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
