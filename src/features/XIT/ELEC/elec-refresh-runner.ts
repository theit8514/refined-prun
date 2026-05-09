import type { LogTag } from '@src/features/XIT/ACT/runner/logger';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { TileAllocator } from '@src/features/XIT/ACT/runner/tile-allocator';

export interface ElecRefreshStep {
  kind: 'ADM' | 'COGC';
  planetNaturalId: string;
  command: string;
}

/** `ADM` = administration tiles only; `COGC` = council tiles only; `both` = ADM then COGC per planet. */
export type ElecRefreshQueueScope = 'both' | 'ADM' | 'COGC';

export interface ElecRefreshCallbacks {
  onBufferSplit: () => void;
  onLog: (tag: LogTag, message: string) => void;
  /** True while awaiting `requestTile` for the current click step. */
  onBusyChange: (busy: boolean) => void;
}

/** Unique planet natural ids (first-seen casing) for every site you have. */
export function collectElectionRefreshPlanetIds(): string[] {
  const sites = sitesStore.all.value;
  if (!sites) {
    return [];
  }
  const seen = new Map<string, string>();
  for (const site of sites) {
    const naturalId = getEntityNaturalIdFromAddress(site.address);
    if (!naturalId) {
      continue;
    }
    const key = naturalId.toUpperCase();
    if (!seen.has(key)) {
      seen.set(key, naturalId);
    }
  }
  return [...seen.values()];
}

/**
 * One runnable step per click: sequential `ADM` / `COGC` loads in the ACT-style companion tile
 * (`TileAllocator`).
 */
export class ElecDataRefreshRunner {
  private allocator: TileAllocator;
  private steps: ElecRefreshStep[] = [];
  private stepIndex = 0;
  private prepared = false;

  constructor(
    tile: PrunTile,
    private callbacks: ElecRefreshCallbacks,
  ) {
    this.allocator = new TileAllocator({
      tile,
      onBufferSplit: () => callbacks.onBufferSplit(),
    });
  }

  prepare(planetNaturalIds: string[], scope: ElecRefreshQueueScope = 'both') {
    if (planetNaturalIds.length === 0) {
      this.callbacks.onLog('WARNING', 'No bases — queue empty.');
      this.clearSteps();
      return;
    }

    this.steps = [];
    for (const id of planetNaturalIds) {
      if (scope === 'both' || scope === 'ADM') {
        this.steps.push({
          kind: 'ADM',
          planetNaturalId: id,
          command: `ADM ${id}`,
        });
      }
      if (scope === 'both' || scope === 'COGC') {
        this.steps.push({
          kind: 'COGC',
          planetNaturalId: id,
          command: `COGC ${id}`,
        });
      }
    }
    this.stepIndex = 0;
    this.prepared = true;
    const scopeNote =
      scope === 'both' ? 'ADM and COGC per planet' : scope === 'ADM' ? 'ADM only' : 'COGC only';
    this.callbacks.onLog(
      'INFO',
      `Queued ${this.steps.length} tiles (${scopeNote}). Click "Next step" to process the queue.`,
    );
  }

  get isPrepared() {
    return this.prepared;
  }

  /**
   * Before any queued steps (or after `reset`), show “prepare first”. Distinct from a finished queue
   * (`prepared === false` but `steps.length > 0`).
   */
  get isAwaitingInitialPrepare(): boolean {
    return this.steps.length === 0 && !this.prepared;
  }

  get totalSteps() {
    return this.steps.length;
  }

  get completedCount() {
    return this.stepIndex;
  }

  /** Has another step — next click loads this command. */
  get hasNext() {
    return this.prepared && this.stepIndex < this.steps.length;
  }

  peekNext(): ElecRefreshStep | undefined {
    return this.steps[this.stepIndex];
  }

  reset() {
    this.clearSteps();
  }

  /** Runs exactly one queued tile load; call once per user click. */
  async advance(): Promise<boolean> {
    if (!this.hasNext) {
      return false;
    }

    const step = this.steps[this.stepIndex];
    try {
      this.callbacks.onBusyChange(true);
      this.callbacks.onLog('ACTION', `${step.planetNaturalId} (${step.command})`);

      const prunTile = await this.allocator.requestTile(step.command);
      if (prunTile === undefined) {
        this.callbacks.onLog('ERROR', 'Failed to open tile — stopping queue.');
        this.clearSteps();
        return false;
      }

      this.stepIndex++;

      if (this.stepIndex >= this.steps.length) {
        this.callbacks.onLog(
          'SUCCESS',
          'All steps done. Use Prepare again if you want another pass.',
        );
        this.prepared = false;
      }

      return true;
    } catch (e) {
      this.callbacks.onLog(
        'ERROR',
        e instanceof Error ? e.message : 'Unexpected error on this step.',
      );
      this.clearSteps();
      return false;
    } finally {
      this.callbacks.onBusyChange(false);
    }
  }

  private clearSteps() {
    this.steps = [];
    this.stepIndex = 0;
    this.prepared = false;
  }
}
