import { deckTotal } from '../domain/normalize';
import type { RemovalItem } from '../domain/types';
import { totals } from '../state';
import type { Action, AppState, Comparison } from '../state';
import { element, requiredElement } from './status';

interface Row {
  node: HTMLLIElement;
  status: HTMLElement;
  checkbox: HTMLInputElement | null;
  plus: HTMLButtonElement | null;
  minus: HTMLButtonElement | null;
}

export function createRemovalList(dispatch: (action: Action) => void) {
  const root = requiredElement('results');
  const list = requiredElement('removal-list');
  const filter = requiredElement<HTMLInputElement>('remaining-filter');
  const completion = requiredElement('completion-message');
  const reset = requiredElement<HTMLButtonElement>('reset-progress');
  const rows = new Map<string, Row>();
  let current: Comparison | null = null;
  filter.addEventListener('change', () => dispatch({ type: 'remaining-only', value: filter.checked }));
  reset.addEventListener('click', () => dispatch({ type: 'reset-progress' }));

  function createRow(item: RemovalItem, index: number): Row {
    const node = element('li', 'removal-row');
    node.dataset['cardName'] = item.name;
    const identity = element('div', 'card-identity');
    identity.append(element('span', 'row-index', String(index + 1).padStart(2, '0')));
    const nameBlock = element('div');
    nameBlock.append(element('h3', 'card-name', item.name), element('p', 'card-quantity', `Remove ${item.quantityToRemove} ${item.quantityToRemove === 1 ? 'copy' : 'copies'}`));
    identity.append(nameBlock);
    const controls = element('div', 'row-controls');
    const status = element('span', 'copy-progress');
    let checkbox: HTMLInputElement | null = null;
    let plus: HTMLButtonElement | null = null;
    let minus: HTMLButtonElement | null = null;
    if (item.quantityToRemove === 1) {
      checkbox = element('input', 'removal-checkbox'); checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', `Mark ${item.name} removed`);
      checkbox.addEventListener('change', () => dispatch({ type: 'adjust', key: item.key, delta: checkbox?.checked ? 1 : -1 }));
      controls.append(status, checkbox);
    } else {
      minus = element('button', 'step-button', '−'); plus = element('button', 'step-button', '+');
      minus.type = plus.type = 'button';
      minus.setAttribute('aria-label', `Undo one ${item.name} removal`);
      plus.setAttribute('aria-label', `Mark one ${item.name} removed`);
      minus.addEventListener('click', () => dispatch({ type: 'adjust', key: item.key, delta: -1 }));
      plus.addEventListener('click', () => dispatch({ type: 'adjust', key: item.key, delta: 1 }));
      controls.append(minus, status, plus);
    }
    node.append(identity, controls);
    return { node, status, checkbox, plus, minus };
  }

  return {
    render(state: AppState) {
      root.hidden = !state.comparison;
      if (!state.comparison) { current = null; rows.clear(); list.replaceChildren(); return; }
      if (current !== state.comparison) {
        current = state.comparison;
        rows.clear(); list.replaceChildren();
        requiredElement('original-name').textContent = current.original.name;
        requiredElement('target-name').textContent = current.target.name;
        const originalTotal = deckTotal(current.original);
        const targetTotal = deckTotal(current.target);
        requiredElement('original-total').textContent = `${originalTotal} ${originalTotal === 1 ? 'card' : 'cards'} · mainboard + commanders`;
        requiredElement('target-total').textContent = `${targetTotal} ${targetTotal === 1 ? 'card' : 'cards'} · mainboard + commanders`;
        current.items.forEach((item, index) => {
          const row = createRow(item, index);
          rows.set(item.key, row); list.append(row.node);
        });
      }
      const count = totals(state);
      requiredElement('removed-count').textContent = String(count.removed);
      requiredElement('required-count').textContent = ` / ${count.required}`;
      requiredElement('remaining-count').textContent = `${count.remaining} left to pull`;
      const progress = requiredElement<HTMLProgressElement>('removal-progress');
      progress.max = count.required || 1;
      progress.value = count.required ? count.removed : 1;
      requiredElement('progress-announcement').textContent = `${count.removed} of ${count.required} copies removed. ${count.remaining} remaining.`;
      filter.checked = state.remainingOnly;
      reset.disabled = count.removed === 0;
      if (reset.disabled && document.activeElement === reset) filter.focus();
      let hiddenFocusedRow = false;
      for (const item of current.items) {
        const row = rows.get(item.key);
        if (!row) continue;
        const removed = state.progress.get(item.key) ?? 0;
        const done = removed === item.quantityToRemove;
        const active = document.activeElement;
        const focused = row.node.contains(active);
        row.node.classList.toggle('is-complete', done);
        row.node.hidden = state.remainingOnly && done;
        row.status.textContent = item.quantityToRemove === 1 ? (done ? 'Removed' : 'To remove') : `${removed} of ${item.quantityToRemove} removed`;
        if (row.checkbox) row.checkbox.checked = done;
        if (row.minus) row.minus.disabled = removed === 0;
        if (row.plus) row.plus.disabled = done;
        if (focused && row.node.hidden) hiddenFocusedRow = true;
        else if (focused && active === row.plus && done) row.minus?.focus();
        else if (focused && active === row.minus && removed === 0) row.plus?.focus();
      }
      if (hiddenFocusedRow) filter.focus();
      completion.hidden = count.required > 0 && count.remaining > 0;
      completion.textContent = count.required === 0
        ? 'No removals needed. Every card in your original deck can stay.'
        : count.remaining === 0 ? 'All removals completed. Your deck has room for what’s next.' : '';
    },
  };
}
