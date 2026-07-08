import { format, formatDistanceToNowStrict } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function RelTime({
  iso,
  className,
}: {
  iso: string | null | undefined;
  className?: string;
}) {
  if (!iso) return <span className={"text-[var(--text-tertiary)] " + (className ?? "")}>—</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <span className={"text-[var(--text-tertiary)] " + (className ?? "")}>—</span>;
  }
  const ageMs = Date.now() - d.getTime();
  if (ageMs >= 0 && ageMs < 10_000) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={"num text-[var(--text-secondary)] " + (className ?? "")}>
              just now
            </span>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">
            {format(d, "MMM d, yyyy HH:mm")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  const rel = formatDistanceToNowStrict(d, { addSuffix: false })
    .replace(" seconds", "s")
    .replace(" second", "s")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace(" years", "y")
    .replace(" year", "y");
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={"num text-[var(--text-secondary)] " + (className ?? "")}>{rel} ago</span>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-xs">
          {format(d, "MMM d, yyyy HH:mm")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
