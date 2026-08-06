import css from '@src/utils/css-utils.module.css';

function init() {
  applyCssRule('INV', 'tr > :nth-child(3)', css.hidden);
}

features.add(import.meta.url, init, 'INV: Hides the "Name" column.');
