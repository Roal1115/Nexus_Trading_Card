import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getTournamentFileUrl } from "@/lib/nexus-tournament-files.functions";
import { FileDown, FileX } from "lucide-react";

export function FileLink({
  url,
  label = "Descargar",
  size = "sm",
}: {
  url: string | null | undefined;
  label?: string;
  size?: "sm" | "md";
}) {
  const fetchUrl = useServerFn(getTournamentFileUrl);
  const [opening, setOpening] = useState(false);
  const iconSize = size === "md" ? 14 : 12;
  const textCls = size === "md" ? "text-sm" : "text-xs";

  if (!url) {
    return (
      <span className={`inline-flex items-center gap-1 ${textCls} text-gray-500`}>
        <FileX size={iconSize} />
        Sin archivo
      </span>
    );
  }
  const onOpen = async () => {
    // Se abre antes de esperar al servidor: después del await el navegador lo bloquearía.
    const tab = window.open("", "_blank");
    setOpening(true);
    try {
      const { url: signedUrl } = await fetchUrl({ data: { file: url } });
      if (tab) tab.location.href = signedUrl;
      else window.location.href = signedUrl;
    } catch (e: any) {
      tab?.close();
      toast.error(e?.message ?? "No se pudo abrir el archivo");
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={opening}
      className={`inline-flex items-center gap-1 ${textCls} text-primary hover:underline disabled:opacity-50`}
    >
      <FileDown size={iconSize} />
      {label}
    </button>
  );
}
