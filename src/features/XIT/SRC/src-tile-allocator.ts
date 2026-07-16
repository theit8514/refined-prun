import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { changeInputValue, clickElement } from '@src/util';
import { sleep } from '@src/utils/sleep';
import { setBufferSize, showBuffer } from '@src/infrastructure/prun-ui/buffers';

interface SrcTileAllocatorOptions {
  tile: PrunTile;
  onBufferSplit: () => void;
}

type SrcTileSlot = 'blu' | 'btf';

const SPLIT_WIDTH_BOOST = 450;
const SPLIT_HEIGHT_BOOST = 600;

/**
 * Allocates two companion panes beside SRC so BLU and BTF can stay open together.
 *
 * Layout after both splits:
 *   Window → Node → [ SRC | Node → [ BLU / BTF ] ]
 */
export class SrcTileAllocator {
  private srcTile: PrunTile;
  private bluTile?: HTMLElement;
  private btfTile?: HTMLElement;

  constructor(options: SrcTileAllocatorOptions) {
    this.srcTile = options.tile;
    const isSoloBuffer = options.tile.container.classList.contains(C.Window.body);
    if (isSoloBuffer) {
      options.onBufferSplit();
      splitTile(options.tile, SPLIT_WIDTH_BOOST);
      return;
    }
    this.refreshFromDom();
  }

  async requestTile(command: string) {
    const slot = resolveSlot(command);
    await this.ensureSlot(slot);
    const target = slot === 'btf' ? this.btfTile : this.bluTile;
    if (target?.isConnected) {
      await changeTileCommand(target, command);
      return tiles.findByContainer(target.parentElement)[0];
    }

    const opened = await openFloatingTile(command);
    if (slot === 'btf') {
      this.btfTile = opened;
    } else {
      this.bluTile = opened;
    }
    return tiles.findByContainer(opened?.parentElement)[0];
  }

  private refreshFromDom() {
    const panes = getCompanionPanes(this.srcTile);
    if (panes.length >= 2) {
      this.bluTile = panes[0];
      this.btfTile = panes[1];
      return;
    }
    if (panes.length === 1) {
      if (!this.bluTile?.isConnected && !this.btfTile?.isConnected) {
        this.bluTile = panes[0];
        this.btfTile = undefined;
      }
    }
  }

  private async ensureSlot(slot: SrcTileSlot) {
    this.refreshFromDom();
    const target = slot === 'btf' ? this.btfTile : this.bluTile;
    if (target?.isConnected) {
      return;
    }

    const other = slot === 'btf' ? this.bluTile : this.btfTile;
    if (other?.isConnected) {
      await this.splitCompanion(other, slot === 'btf' ? 'blu' : 'btf');
      return;
    }

    const panes = getCompanionPanes(this.srcTile);
    if (panes.length >= 2) {
      this.bluTile = panes[0];
      this.btfTile = panes[1];
      return;
    }
    if (panes.length === 1) {
      if (slot === 'btf') {
        this.btfTile = panes[0];
      } else {
        this.bluTile = panes[0];
      }
    }
  }

  private async splitCompanion(existing: HTMLElement, existingSlot: SrcTileSlot) {
    const prunTile = tiles.findByContainer(existing.parentElement)[0];
    if (prunTile === undefined) {
      return;
    }

    splitTileVertical(prunTile, SPLIT_HEIGHT_BOOST);
    await waitForCompanionPanes(this.srcTile, 2);
    const panes = getCompanionPanes(this.srcTile);
    if (panes.length < 2) {
      return;
    }

    // Left/first pane keeps the existing command; right/second is the new empty tile.
    if (existingSlot === 'blu') {
      this.bluTile = panes[0];
      this.btfTile = panes[1];
    } else {
      this.btfTile = panes[0];
      this.bluTile = panes[1];
    }
  }
}

function resolveSlot(command: string): SrcTileSlot {
  return command.toUpperCase().startsWith('BTF') ? 'btf' : 'blu';
}

function getCompanionChildContainer(srcTile: PrunTile) {
  const isInNodeChild = srcTile.container.classList.contains(C.Node.child);
  const node = srcTile.container.parentElement;
  const isInNode = node?.classList.contains(C.Node.node);
  const isInWindow = node?.parentElement?.classList.contains(C.Window.body);
  if (!isInNodeChild || !isInNode || !isInWindow) {
    return undefined;
  }
  return _$$(node!, C.Node.child).find(x => x !== srcTile.container);
}

function getCompanionPanes(srcTile: PrunTile) {
  const companionChild = getCompanionChildContainer(srcTile);
  if (!companionChild) {
    return [];
  }

  const nestedNode = companionChild.classList.contains(C.Node.node)
    ? companionChild
    : (_$(companionChild, C.Node.node) as HTMLElement | undefined);

  if (nestedNode) {
    return _$$(nestedNode, C.Node.child)
      .map(x => _$(x, C.Tile.tile) as HTMLElement | undefined)
      .filter((x): x is HTMLElement => x !== undefined);
  }

  const tile = _$(companionChild, C.Tile.tile) as HTMLElement | undefined;
  return tile ? [tile] : [];
}

async function waitForCompanionPanes(srcTile: PrunTile, count: number) {
  if (getCompanionPanes(srcTile).length >= count) {
    return;
  }

  const root = srcTile.container.parentElement?.parentElement ?? document.body;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Timed out waiting for companion tile split'));
    }, 15_000);

    const observer = new MutationObserver(() => {
      if (getCompanionPanes(srcTile).length >= count) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  });
}

async function changeTileCommand(tile: HTMLElement, command: string) {
  const id = getPrunId(tile)!;
  let message = UI_TILES_CHANGE_COMMAND(id, null);
  if (!dispatchClientPrunMessage(message)) {
    const changeButton = _$$(tile, C.TileControls.control).find(x => x.textContent === ':');
    await clickElement(changeButton);
  } else {
    await sleep(0);
  }
  message = UI_TILES_CHANGE_COMMAND(id, command);
  if (!dispatchClientPrunMessage(message)) {
    const input = (await $(tile, C.PanelSelector.input)) as HTMLInputElement;
    changeInputValue(input, command);
    input.form!.requestSubmit();
  }
  await $(tile, C.TileFrame.frame);
}

async function openFloatingTile(command: string) {
  const window = await showBuffer(command, { autoSubmit: true });
  await sleep(0);
  const body = _$(window, C.Window.body);
  return body ? (_$(body, C.Tile.tile) as HTMLElement | undefined) : undefined;
}

function splitTile(tile: PrunTile, widthBoost: number) {
  const { width, height } = getWindowSize(tile);
  setBufferSize(tile.id, width + widthBoost, height);
  const changeButton = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '|');
  void clickElement(changeButton);
}

function splitTileVertical(tile: PrunTile, heightBoost: number) {
  const { width, height } = getWindowSize(tile);
  setBufferSize(tile.id, width, height + heightBoost);
  const changeButton = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '–');
  void clickElement(changeButton);
}

/** Nested panes often lack style.width/height; size the floating window body instead. */
function getWindowSize(tile: PrunTile) {
  const body =
    (tile.window ? (_$(tile.window, C.Window.body) as HTMLElement | undefined) : undefined) ??
    (tile.container.classList.contains(C.Window.body)
      ? tile.container
      : (tile.container.closest(`.${C.Window.body}`) as HTMLElement | null));

  const el = body ?? tile.container;
  const width = parseInt(el.style.width.replace('px', ''), 10);
  const height = parseInt(el.style.height.replace('px', ''), 10);
  return {
    width: Number.isFinite(width) ? width : el.clientWidth,
    height: Number.isFinite(height) ? height : el.clientHeight,
  };
}
