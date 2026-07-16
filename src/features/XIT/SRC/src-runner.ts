import { Logger } from '@src/features/XIT/ACT/runner/logger';
import { SrcTileAllocator } from '@src/features/XIT/SRC/src-tile-allocator';
import { buildSrcSteps, SrcInputs, SrcStep } from '@src/features/XIT/SRC/steps';
import { sleep } from '@src/utils/sleep';

interface SrcRunnerOptions {
  tile: PrunTile;
  log: Logger;
  onBufferSplit: () => void;
  onStart: () => void;
  onEnd: () => void;
  onStatusChanged: (status: string, keepReady?: boolean) => void;
  onActReady: () => void;
}

export class SrcRunner {
  private allocator: SrcTileAllocator;
  private steps: SrcStep[] = [];
  private current?: SrcStep;
  private nextAct?: () => void;

  constructor(private options: SrcRunnerOptions) {
    this.allocator = new SrcTileAllocator({
      tile: options.tile,
      onBufferSplit: () => options.onBufferSplit(),
    });
  }

  get isRunning() {
    return this.current !== undefined;
  }

  get log() {
    return this.options.log;
  }

  start(inputs: SrcInputs) {
    if (this.isRunning) {
      this.log.error('Collection is already running');
      return;
    }
    this.steps = buildSrcSteps(inputs);
    this.options.onStart();
    void this.startNext();
  }

  act() {
    if (!this.ensureRunning()) {
      return;
    }
    const nextAct = this.nextAct;
    this.nextAct = undefined;
    nextAct?.();
  }

  skip() {
    if (!this.ensureRunning()) {
      return;
    }
    const current = this.current;
    if (!current) {
      return;
    }
    this.log.skip(current.description);
    this.nextAct = undefined;
    void this.startNext();
  }

  cancel() {
    if (!this.ensureRunning()) {
      return;
    }
    this.log.cancel('Ship repair data collection canceled');
    this.stop();
  }

  stop() {
    this.current = undefined;
    this.nextAct = undefined;
    this.steps = [];
    this.options.onEnd();
  }

  private async startNext() {
    if (this.steps.length === 0) {
      this.log.success('Ship repair data collection completed');
      this.stop();
      return;
    }

    const next = this.steps.shift()!;
    this.current = next;
    const log = this.options.log;

    try {
      await next.execute({
        log,
        setStatus: status => this.options.onStatusChanged(status),
        waitAct: async status => {
          await this.waitAct(status ?? next.description);
        },
        complete: async () => {
          await sleep(0);
          log.success(next.description);
          void this.startNext();
        },
        skip: () => this.skip(),
        fail: message => {
          if (message) {
            log.error(message);
          }
          log.error('Ship repair data collection failed');
          this.stop();
        },
        requestTile: async command => await this.requestTile(command),
      });
    } catch (e) {
      log.runtimeError(e);
      this.stop();
    }
  }

  private async requestTile(command: string) {
    let tile = tiles.find(command, true)[0];
    if (tile !== undefined) {
      return tile;
    }
    await this.waitAct(`Open ${command}`);
    this.options.onStatusChanged(`Opening ${command}...`);
    tile = await this.allocator.requestTile(command);
    if (tile === undefined) {
      this.log.error(`Failed to open ${command}`);
      this.stop();
    }
    return tile;
  }

  private async waitAct(status: string) {
    this.options.onStatusChanged(status);
    this.options.onActReady();
    await new Promise<void>(resolve => (this.nextAct = resolve));
  }

  private ensureRunning() {
    if (!this.isRunning) {
      this.log.error('Collection is not running');
    }
    return this.isRunning;
  }
}
