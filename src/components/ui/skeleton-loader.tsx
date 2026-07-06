function shimmer() {
  return "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent";
}

export function SkeletonLine({
  width = "w-full",
  height = "h-3",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div className={`${shimmer()} rounded-md bg-white/[0.06] ${width} ${height} ${className}`} />
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`${shimmer()} rounded-xl bg-white/[0.06] ${className}`} />;
}

// Skeleton para una fila del leaderboard
export function LeaderboardRowSkeleton() {
  return (
    <tr className="border-b border-white/5">
      <td className="px-3 py-2.5">
        <SkeletonLine width="w-6" height="h-3" />
      </td>
      <td className="px-3 py-2.5">
        <SkeletonLine width="w-32" height="h-3" />
      </td>
      <td className="hidden px-3 py-2.5 sm:table-cell">
        <SkeletonLine width="w-20" height="h-3" />
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end">
          <SkeletonLine width="w-14" height="h-3" />
        </div>
      </td>
      <td className="hidden px-3 py-2.5 sm:table-cell text-right">
        <div className="flex justify-end">
          <SkeletonLine width="w-6" height="h-3" />
        </div>
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell text-right">
        <div className="flex justify-end">
          <SkeletonLine width="w-6" height="h-3" />
        </div>
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell text-right">
        <div className="flex justify-end">
          <SkeletonLine width="w-12" height="h-3" />
        </div>
      </td>
    </tr>
  );
}

// Skeleton para card de tienda
export function StoreCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <SkeletonLine width="w-3/4" height="h-5" />
      <SkeletonLine width="w-1/3" height="h-3" />
      <div className="flex gap-1.5 pt-1">
        <SkeletonLine width="w-16" height="h-5" className="rounded-md" />
        <SkeletonLine width="w-20" height="h-5" className="rounded-md" />
      </div>
      <SkeletonLine width="w-2/5" height="h-3" />
      <div className="flex justify-between items-center pt-2 border-t border-white/5">
        <div className="flex gap-2">
          <SkeletonBlock className="w-4 h-4" />
          <SkeletonBlock className="w-4 h-4" />
        </div>
        <SkeletonLine width="w-24" height="h-7" className="rounded-md" />
      </div>
    </div>
  );
}

// Skeleton para TcgRankCard del dashboard
export function TcgRankCardSkeleton() {
  return (
    <div className="glass w-full rounded-2xl border border-white/10 p-5 space-y-3 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]">
      <SkeletonLine width="w-1/2" height="h-4" />
      <SkeletonBlock className="h-8 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-2">
          <SkeletonLine width="w-16" height="h-2" />
          <SkeletonLine width="w-12" height="h-8" />
        </div>
        <div className="space-y-2">
          <SkeletonLine width="w-16" height="h-2" />
          <SkeletonLine width="w-12" height="h-8" />
        </div>
      </div>
    </div>
  );
}

// Skeleton para fila de torneos del dashboard
export function TournamentRowSkeleton() {
  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3">
        <SkeletonLine width="w-16" height="h-3" />
      </td>
      <td className="px-4 py-3">
        <SkeletonLine width="w-40" height="h-3" />
      </td>
      <td className="px-4 py-3">
        <SkeletonLine width="w-20" height="h-3" />
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex justify-center">
          <SkeletonLine width="w-10" height="h-3" />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end">
          <SkeletonLine width="w-8" height="h-3" />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end">
          <SkeletonLine width="w-14" height="h-3" />
        </div>
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="w-6 h-6 rounded-md" />
      </td>
    </tr>
  );
}

// Skeleton para settings
export function SettingsSectionSkeleton() {
  return (
    <div className="glass space-y-4 rounded-2xl p-6">
      <SkeletonLine width="w-40" height="h-4" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <SkeletonLine width="w-16" height="h-2" />
          <SkeletonBlock className="h-9 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <SkeletonLine width="w-24" height="h-2" />
          <SkeletonBlock className="h-9 w-full rounded-md" />
        </div>
      </div>
      <SkeletonLine width="w-32" height="h-8" className="rounded-lg" />
    </div>
  );
}
