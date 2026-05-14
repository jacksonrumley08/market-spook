import { cn } from '@/lib/utils';
import type { Party } from '@/api/types-ui';

export function PartyChip({ party, state, chamber, className }: { party: Party; state?: string; chamber?: string; className?: string }) {
  const color =
    party === 'D' ? 'text-[var(--blue)] ring-[var(--blue)]/30 bg-[var(--blue)]/10'
    : party === 'R' ? 'text-[var(--red)] ring-[var(--red)]/30 bg-[var(--red)]/10'
    : 'text-[var(--text-secondary)] ring-[var(--border)] bg-[var(--bg-2)]';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ring-1', color, className)}>
      <span>{party}</span>
      {state && <span className="text-[var(--text-secondary)]">·</span>}
      {state && <span>{state}</span>}
      {chamber && <span className="text-[var(--text-secondary)]">·</span>}
      {chamber && <span>{chamber === 'senate' ? 'SEN' : 'HSE'}</span>}
    </span>
  );
}
