import css from '@src/utils/css-utils.module.css';
import { refTextContent } from '@src/utils/reactive-dom';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';
import { isEmpty } from 'ts-extras';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, 'tr'), row => {
    if (_$(row, 'th') !== undefined) {
      return;
    }
    if (row.classList.contains(C.IncomeStatementPanel.totals)) {
      return;
    }

    const cells = _$$(row, C.IncomeStatementPanel.number);
    if (isEmpty(cells)) {
      return;
    }

    const texts = cells.map(x => refTextContent(x));
    watchEffectWhileNodeAlive(row, () => {
      row.classList.toggle(
        css.hidden,
        texts.every(x => isZeroText(x.value)),
      );
    });
  });
}

function isZeroText(text: string | null) {
  if (!text) {
    return true;
  }
  const digits = text.replace(/\D/g, '');
  return digits === '' || /^0+$/.test(digits);
}

function init() {
  tiles.observe('FINIS', onTileReady);
}

features.add(import.meta.url, init, 'FINIS: Hides rows with all zero values.');
