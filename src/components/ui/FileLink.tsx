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
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 ${textCls} text-primary hover:underline`}
    >
      <FileDown size={iconSize} />
      {label}
    </a>
  );
}
