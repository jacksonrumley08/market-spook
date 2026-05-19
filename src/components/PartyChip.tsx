import { cn } from "@/lib/utils";
import type { Party } from "@/api/types-ui";

export function PartyChip({
  party,
  state,
  chamber,
  className,
}: {
  party: Party | null | undefined;
  state?: string | null;
  chamber?: string | null;
  className?: string;
}) {
  const color =
    party === "D"
      ? "text-[var(--blue)] ring-[var(--blue)]/30 bg-[var(--blue)]/10"
      : party === "R"
        ? "text-[var(--red)] ring-[var(--red)]/30 bg-[var(--red)]/10"
        : party === "I"
          ? "text-[var(--text-primary)] ring-[var(--border)] bg-[var(--bg-2)]"
          : "text-[var(--text-tertiary)] ring-[var(--border)] bg-[var(--bg-2)]";
  const partyLabel = party === "D" || party === "R" || party === "I" ? party : "IND";
  const showState = state && state !== "None" && state.length > 0;
  const showChamber = chamber && chamber.length > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase ring-1",
        color,
        className,
      )}
    >
      <span>{partyLabel}</span>
      {showState && <span className="text-[var(--text-secondary)]">·</span>}
      {showState && <span>{state}</span>}
      {showChamber && <span className="text-[var(--text-secondary)]">·</span>}
      {showChamber && <span>{chamber === "senate" ? "Sen" : "Rep"}</span>}
    </span>
  );
}
