import { changeInputValue, clickElement, focusElement } from '@src/util';
import {
  getAddressMatchTerms,
  getAddressSearchQuery,
} from '@src/infrastructure/prun-ui/address-target';

function findMatchingSuggestion(suggestionsList: Element, naturalId: string) {
  const terms = getAddressMatchTerms(naturalId);
  const suggestions = _$$(suggestionsList, C.AddressSelector.suggestion);
  // Prefer earlier terms (station name before id) across the whole list.
  for (const term of terms) {
    const match = suggestions.find(x => (x.textContent ?? '').includes(term));
    if (match) {
      return match;
    }
  }
  return undefined;
}

/** Wait until the portalled address search finishes and a matching row appears. */
async function waitForAddressSearchResults(naturalId: string) {
  const query = getAddressSearchQuery(naturalId);
  const app = await $(document, C.App.container);

  await $(app, C.AddressSelector.suggestionsContainerOpen);
  const suggestionsList = await $(app, C.AddressSelector.suggestionsList);

  const existing = findMatchingSuggestion(suggestionsList, naturalId);
  if (existing) {
    return existing;
  }

  return await new Promise<HTMLElement>((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Address search timed out for ${query}`));
    }, 60_000);

    const observer = new MutationObserver(() => {
      const match = findMatchingSuggestion(suggestionsList, naturalId);
      if (match) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(match);
      }
    });
    observer.observe(suggestionsList, { childList: true, subtree: true });
  });
}

/** Fill an AddressSelector (row or container) with a location by natural id. */
export async function selectAddressInSelector(row: HTMLElement, naturalId: string) {
  const query = getAddressSearchQuery(naturalId);

  let container: Element = row;
  if (!container.classList.contains(C.AddressSelector.container)) {
    container = (await $(row, C.AddressSelector.container)) as HTMLElement;
  }

  const input = (await $(container, C.AddressSelector.input)) as HTMLInputElement;
  focusElement(input);
  changeInputValue(input, query);

  try {
    const match = await waitForAddressSearchResults(naturalId);
    const app = await $(document, C.App.container);
    const suggestionsContainer = _$(app, C.AddressSelector.suggestionsContainer);
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
    await clickElement(match);
    if (suggestionsContainer) {
      suggestionsContainer.style.display = '';
    }
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : `Address suggestion not found for ${query}`;
  }
}

function variableLabelText(variable: Element) {
  const label = _$(variable, 'label');
  const span = label ? _$(label, 'span') : undefined;
  return span?.textContent?.trim();
}

/** Find the ScreenVariableControls Location AddressSelector for a variable name. */
export function findScreenLocationVariableControl(variableName: string) {
  const bars = _$$(document, C.ScreenVariableControls.bar);
  for (const bar of bars) {
    const variables = _$$(bar, C.ScreenVariableControls.variable);
    for (const variable of variables) {
      if (variableLabelText(variable) !== variableName) {
        continue;
      }
      if (!_$(variable, C.AddressSelector.container)) {
        continue;
      }
      return variable as HTMLElement;
    }
  }
  return undefined;
}

/** Drive the screen chrome AddressSelector for a LOCATION screen variable. */
let selectionInProgress = false;

export async function setScreenLocationVariable(variableName: string, naturalId: string) {
  if (selectionInProgress) {
    return 'Location variable selection already in progress';
  }
  const control = findScreenLocationVariableControl(variableName);
  if (!control) {
    return `Location variable control not found for ${variableName}`;
  }
  selectionInProgress = true;
  try {
    return await selectAddressInSelector(control, naturalId);
  } finally {
    selectionInProgress = false;
  }
}
