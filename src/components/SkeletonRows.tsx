import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-6 flex-1 bg-[var(--bg-2)]" />
          ))}
        </div>
      ))}
    </div>
  );
}
