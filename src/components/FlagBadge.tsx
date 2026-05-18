import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DerivedFlags } from "@/api/types-ui";

type FlagKey = keyof DerivedFlags;

const META: Record<string, { label: string; color: string; ring: string }> = {
  jurisdiction_overlap: {
    label: "JURIS",
    color: "bg-[var(--purple)]/15 text-[var(--purple)]",
    ring: "ring-[var(--purple)]/30",
  },
  hearing_proximity: {
    label: "HEARING",
    color: "bg-[var(--cyan)]/15 text-[var(--cyan)]",
    ring: "ring-[var(--cyan)]/30",
  },
  contract_proximity: {
    label: "CONTRACT",
    color: "bg-[var(--blue)]/15 text-[var(--blue)]",
    ring: "ring-[var(--blue)]/30",
  },
  lobbying_overlay: {
    label: "LOBBY",
    color: "bg-[var(--amber)]/15 text-[var(--amber)]",
    ring: "ring-[var(--amber)]/30",
  },
  vote_trade_consistency: {
    label: "VOTE",
    color: "bg-[var(--green)]/15 text-[var(--green)]",
    ring: "ring-[var(--green)]/30",
  },
  fomc_blackout: {
    label: "BLACKOUT",
    color: "bg-[var(--red)]/15 text-[var(--red)]",
    ring: "ring-[var(--red)]/30",
  },
  cluster_id: {
    label: "CLUSTER",
    color: "bg-[var(--cluster-active)]/15 text-[var(--cluster-active)]",
    ring: "ring-[var(--cluster-active)]/30",
  },
};

function flagDetail(key: FlagKey, flags: DerivedFlags): React.ReactNode {
  switch (key) {
    case "jurisdiction_overlap":
      return (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase text-[var(--text-secondary)]">
            Committees with overlapping jurisdiction
          </div>
          {flags.jurisdiction_overlap?.map(
            (j: import("@/api/types-ui").JurisdictionOverlapFlag) => (
              <div key={j.committee_id} className="text-sm">
                {j.committee_name}
              </div>
            ),
          )}
        </div>
      );
    case "hearing_proximity": {
      const h = flags.hearing_proximity!;
      return (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase text-[var(--text-secondary)]">
            Hearing proximity
          </div>
          <div className="text-sm">{h.topic}</div>
          <div className="num text-xs text-[var(--text-secondary)]">
            {h.days_delta >= 0 ? `${h.days_delta}d after` : `${Math.abs(h.days_delta)}d before`}
          </div>
        </div>
      );
    }
    case "contract_proximity": {
      const c = flags.contract_proximity!;
      return (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase text-[var(--text-secondary)]">
            Contract proximity
          </div>
          <div className="text-sm">
            {c.agency} — <span className="num">${(c.award_value / 1e6).toFixed(1)}M</span>
          </div>
          <div className="num text-xs text-[var(--text-secondary)]">
            {c.days_delta >= 0 ? `${c.days_delta}d after` : `${Math.abs(c.days_delta)}d before`}
          </div>
        </div>
      );
    }
    case "lobbying_overlay": {
      const l = flags.lobbying_overlay!;
      return (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase text-[var(--text-secondary)]">
            Lobbying overlay
          </div>
          <div className="text-sm">{l.registrant}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {l.client} • {l.topics.join(", ")}
          </div>
        </div>
      );
    }
    case "vote_trade_consistency": {
      const v = flags.vote_trade_consistency!;
      return (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase text-[var(--text-secondary)]">
            Vote-trade consistency
          </div>
          <div className="text-sm">
            {v.bill_id} — {v.bill_title}
          </div>
          <div className="text-xs uppercase text-[var(--text-secondary)]">
            Position: {v.position} • <span className="num">{v.days_delta}d</span>
          </div>
        </div>
      );
    }
    case "fomc_blackout":
      return <div className="text-sm">Trade executed during FOMC blackout window</div>;
    default:
      return null;
  }
}

export function FlagBadge({
  flag,
  flags,
  withPopover = true,
}: {
  flag: FlagKey;
  flags: DerivedFlags;
  withPopover?: boolean;
}) {
  const m = META[flag as string];
  if (!m) return null;
  const hasValue = flag === "fomc_blackout" ? !!flags.fomc_blackout : !!flags[flag];
  if (!hasValue) return null;

  const pill = (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1",
        m.color,
        m.ring,
      )}
    >
      {m.label}
    </span>
  );

  if (!withPopover || flag === "fomc_blackout" || flag === "cluster_id") {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{pill}</TooltipTrigger>
          <TooltipContent className="text-xs">{m.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button>{pill}</button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-[var(--bg-2)] border-[var(--border)]">
        {flagDetail(flag, flags)}
      </PopoverContent>
    </Popover>
  );
}

export function FlagRow({ flags }: { flags: DerivedFlags }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(META) as (keyof typeof META)[]).map((k) => (
        <FlagBadge key={k} flag={k as FlagKey} flags={flags} />
      ))}
    </div>
  );
}
