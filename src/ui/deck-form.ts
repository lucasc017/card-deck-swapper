import { deckTotal } from '../domain/normalize';
import type { DeckSide, DeckSnapshot, ImportFailure } from '../domain/types';
import { element } from './status';

export type DeckInput = { readonly kind: 'url' | 'text'; readonly value: string };

export function createDeckForm(side: DeckSide, onEdit: () => void) {
  const title = side === 'original' ? 'Original deck' : 'Target deck';
  const root = element('section', `deck-card deck-card-${side}`);
  root.setAttribute('aria-labelledby', `${side}-heading`);
  const top = element('div', 'deck-card-heading');
  const heading = element('div');
  heading.append(element('p', 'eyebrow', side === 'original' ? '01 / CURRENT BUILD' : '02 / NEXT BUILD'));
  const h3 = element('h3', '', title);
  h3.id = `${side}-heading`;
  heading.append(h3, element('p', 'deck-card-description', side === 'original' ? 'The deck on your table.' : 'The list you’re working toward.'));
  top.append(heading, element('span', 'deck-symbol', side === 'original' ? '−' : '→'));
  const switcher = element('div', 'source-switch');
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', `${title} source`);
  const urlButton = element('button', '', 'Moxfield link');
  const textButton = element('button', '', 'Paste list');
  urlButton.type = textButton.type = 'button';
  switcher.append(urlButton, textButton);
  const urlPanel = element('div', 'source-panel');
  const urlLabel = element('label', 'field-label', 'Moxfield deck URL');
  urlLabel.htmlFor = `${side}-url`;
  const url = element('input', 'text-input');
  url.type = 'url'; url.id = `${side}-url`; url.name = `${side}-url`;
  url.placeholder = 'https://moxfield.com/decks/…'; url.autocomplete = 'off';
  url.spellcheck = false; url.setAttribute('autocapitalize', 'off');
  urlPanel.append(urlLabel, url, element('p', 'field-help', 'Public or unlisted decks. Direct imports depend on Moxfield access.'));
  const textPanel = element('div', 'source-panel');
  const textLabel = element('label', 'field-label', 'Deck export');
  textLabel.htmlFor = `${side}-text`;
  const text = element('textarea', 'text-input deck-text');
  text.id = `${side}-text`; text.name = `${side}-text`; text.rows = 7;
  text.placeholder = 'Commander\n1 Your commander\n\nDeck\n1 Sol Ring\n9 Forest';
  text.autocomplete = 'off'; text.spellcheck = false; text.setAttribute('autocapitalize', 'off');
  const help = element('details', 'export-help');
  const steps = element('ol');
  for (const instruction of [
    'Open the deck’s Export menu on Moxfield and copy a text or Arena list.',
    'Include mainboard and commander cards. Label separate sections Deck and Commander.',
    'Leave sideboards out, or label them Sideboard. Use canonical English card names.',
  ]) steps.append(element('li', '', instruction));
  help.append(element('summary', '', 'How to export your list'), steps);
  textPanel.append(textLabel, text, help);
  const error = element('div', 'field-error');
  error.id = `${side}-error`; error.setAttribute('role', 'alert'); error.hidden = true;
  const note = element('p', 'import-note'); note.setAttribute('role', 'status');
  root.append(top, switcher, urlPanel, textPanel, error, note);
  let mode: 'url' | 'text' = 'url';

  function clearError() {
    error.hidden = true; error.replaceChildren();
    url.removeAttribute('aria-invalid'); text.removeAttribute('aria-invalid');
    url.removeAttribute('aria-describedby'); text.removeAttribute('aria-describedby');
  }

  function setMode(next: 'url' | 'text', focus = false) {
    mode = next;
    urlPanel.hidden = next !== 'url'; textPanel.hidden = next !== 'text';
    urlButton.setAttribute('aria-pressed', String(next === 'url'));
    textButton.setAttribute('aria-pressed', String(next === 'text'));
    clearError();
    if (focus) (next === 'url' ? url : text).focus();
  }
  urlButton.addEventListener('click', () => { onEdit(); setMode('url', true); });
  textButton.addEventListener('click', () => { onEdit(); setMode('text', true); });
  for (const input of [url, text]) input.addEventListener('input', () => { clearError(); note.textContent = ''; onEdit(); });
  setMode('url');

  return {
    element: root,
    read: (): DeckInput => ({ kind: mode, value: mode === 'url' ? url.value : text.value }),
    clearError,
    loading(value: boolean) { note.textContent = value ? 'Reading your list…' : ''; root.classList.toggle('is-loading', value); },
    ready(deck: DeckSnapshot) { note.textContent = `✓ Ready · ${deckTotal(deck)} cards`; root.classList.remove('is-loading'); },
    showError(failure: ImportFailure) {
      clearError();
      error.append(element('p', '', failure.message));
      if (failure.issues.length) {
        const list = element('ul');
        for (const issue of failure.issues) list.append(element('li', '', `Line ${issue.line}: ${issue.message}`));
        error.append(list);
      }
      if (mode === 'url' && failure.code !== 'invalid-url') {
        const fallback = element('button', 'text-button', 'Use a pasted export instead →');
        fallback.type = 'button';
        fallback.addEventListener('click', () => { onEdit(); setMode('text', true); });
        error.append(fallback);
      }
      error.hidden = false;
      const input = mode === 'url' ? url : text;
      input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id);
      root.classList.remove('is-loading'); note.textContent = '';
    },
    setText(value: string) { text.value = value; url.value = ''; note.textContent = ''; setMode('text'); },
    reset() { url.value = ''; text.value = ''; note.textContent = ''; root.classList.remove('is-loading'); setMode('url'); },
    focus() { (mode === 'url' ? url : text).focus(); },
  };
}
