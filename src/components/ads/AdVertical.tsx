export function AdVertical({ sponsor }: { sponsor: any }) {
  return (
    <div className="hidden xl:flex flex-col items-center w-[160px] flex-shrink-0">
      {sponsor?.vertical_url && (
        <div className="sticky top-8 flex flex-col items-center gap-4">
          <img
            src={sponsor.vertical_url}
            alt={`Patrocinado por ${sponsor.name}`}
            width={160}
            height={600}
            className="rounded-lg object-cover"
            style={{ width: "160px", height: "600px" }}
          />
          <img
            src={sponsor.vertical_url}
            alt={`Patrocinado por ${sponsor.name}`}
            width={160}
            height={600}
            className="rounded-lg object-cover opacity-90"
            style={{ width: "160px", height: "600px" }}
          />
        </div>
      )}
    </div>
  );
}
