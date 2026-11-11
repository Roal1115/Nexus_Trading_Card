export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 font-mono-stat text-xs font-bold leading-none text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}
