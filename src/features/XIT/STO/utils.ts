import { fixed01 } from '@src/utils/format';

export function formatDays(days: number) {
  if (!isFinite(days) || days >= 1000) {
    return '∞';
  }
  return fixed01(days);
}

export function formatDaysCompact(days: number) {
  if (!isFinite(days) || days >= 1000) {
    return '∞';
  }
  if (days > 100) {
    return '100+';
  }
  return fixed01(days);
}

export function fillRatioClass(ratio: number) {
  if (ratio >= 0.95) {
    return C.Workforces.daysMissing;
  }
  if (ratio >= 0.8) {
    return C.Workforces.daysWarning;
  }
  return C.Workforces.daysSupplied;
}
