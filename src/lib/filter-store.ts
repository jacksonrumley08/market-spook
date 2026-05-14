import { create } from 'zustand';

export type DateRangePreset = '7d' | '30d' | '90d' | '180d' | '365d';
export type ChamberFilter = 'all' | 'house' | 'senate';
export type OwnerFilter = 'all' | 'self' | 'spouse' | 'dependent' | 'joint';

interface FilterState {
  range: DateRangePreset;
  chamber: ChamberFilter;
  owner: OwnerFilter;
  set: (p: Partial<Pick<FilterState, 'range' | 'chamber' | 'owner'>>) => void;
}

export const useGlobalFilter = create<FilterState>((set) => ({
  range: '30d',
  chamber: 'all',
  owner: 'all',
  set: (p) => set(p),
}));

export const RANGE_LABEL: Record<DateRangePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '180d': 'Last 180 days',
  '365d': 'Last 365 days',
};
