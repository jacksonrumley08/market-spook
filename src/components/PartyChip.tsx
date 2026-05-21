import { cn } from "@/lib/utils";
import type { Party } from "@/api/types-ui";

const PARTY_NAME: Record<Party, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

export function PartyChip({
  party,
  state,
  chamber,
  className,
}: {
  party: Party;
  state?: string;
  chamber?: string;
  className?: string;
}) {
  const color =
    party === "D"
      ? "text-[var(--blue)] ring-[var(--blue)]/30 bg-[var(--blue)]/10"
      : party === "R"
        ? "text-[var(--red)] ring-[var(--red)]/30 bg-[var(--red)]/10"
        : "text-[var(--text-secondary)] ring-[var(--border)] bg-[var(--bg-2)]";
  // Expand the visible "D"/"R"/"I" letter into the party name for screen
  // readers (WCAG 1.4.1). The letter is already in the DOM so this isn't
  // a color-only signal — aria-label just upgrades narration quality.
  const chamberLabel = chamber === "senate" ? "Senate" : chamber === "house" ? "House" : null;
  const ariaLabel = [PARTY_NAME[party], state, chamberLabel].filter(Boolean).join(", ");
  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ring-1",
        color,
        className,
      )}
    >
      <span aria-hidden="true">{party}</span>
      {state && (
        <span aria-hidden="true" className="text-[var(--text-secondary)]">
          ·
        </span>
      )}
      {state && <span aria-hidden="true">{state}</span>}
      {chamber && (
        <span aria-hidden="true" className="text-[var(--text-secondary)]">
          ·
        </span>
      )}
      {chamber && <span aria-hidden="true">{chamber === "senate" ? "SEN" : "HSE"}</span>}
    </span>
  );
}
