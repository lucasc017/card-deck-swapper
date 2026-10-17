import { deckTotal } from '../domain/normalize';
import { ImportFailure } from '../domain/types';
import type { DeckSide, DeckSnapshot } from '../domain/types';
import { moxfieldApiUrl, parseMoxfieldJson } from '../imports/moxfield';
import type { PreconProvider } from '../imports/precons';
import { createPreconPicker } from './precon-picker';
import { element } from './status';

export type DeckInput =
  | { readonly kind: 'api'; readonly value: string; readonly url: string }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'precon'; readonly id: string };

export interface DeckFormValues {
  readonly mode: 'api' | 'text' | 'precon';
  readonly url: string;
  readonly json: string;
  readonly text: string;
  readonly preconId: string;
}

export function createDeckForm(side: DeckSide, onEdit: () => void, provider: PreconProvider) {
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
  const apiButton = element('button', '', 'Guided API');
  const textButton = element('button', '', 'Paste deck');
  const preconButton = element('button', '', 'Choose precon');
  apiButton.type = textButton.type = preconButton.type = 'button';
  switcher.append(apiButton, textButton, preconButton);

  const apiPanel = element('div', 'source-panel api-guide');
  const openStep = element('div', 'api-step');
  openStep.append(element('h4', 'guide-step-title', '1. Open the API response'));
  const urlLabel = element('label', 'field-label', 'Moxfield deck URL');
  urlLabel.htmlFor = `${side}-url`;
  const url = element('input', 'text-input');
  url.type = 'url'; url.id = `${side}-url`; url.name = `${side}-url`;
  url.placeholder = 'https://moxfield.com/decks/…'; url.autocomplete = 'off';
  url.spellcheck = false; url.setAttribute('autocapitalize', 'off');
  const openApi = element('button', 'api-open-button', 'Open API response ↗');
  openApi.type = 'button';
  openApi.setAttribute('aria-label', 'Open API response in a new tab');
  openStep.append(urlLabel, url, openApi, element('p', 'field-help', 'Opens Moxfield in a new tab. Keep this app open.'));

  const copyStep = element('div', 'api-step');
  copyStep.append(element('h4', 'guide-step-title', '2. Copy the response back here'),
    element('p', 'guide-copy', 'Use the JSON viewer’s Copy option, or view the raw response and select all. Copy the entire response, not just the visible cards. Paste it below, or use the viewer’s Save option and choose that JSON file.'));
  const jsonLabel = element('label', 'field-label', 'API response (JSON)');
  jsonLabel.htmlFor = `${side}-json`;
  const json = element('textarea', 'text-input deck-text');
  json.id = `${side}-json`; json.name = `${side}-json`; json.rows = 6;
  json.placeholder = '{ "name": "Your deck", "boards": { … } }';
  json.autocomplete = 'off'; json.spellcheck = false; json.setAttribute('autocapitalize', 'off');
  const fileLabel = element('label', 'field-label', 'Or choose a saved JSON file');
  fileLabel.htmlFor = `${side}-json-file`;
  const file = element('input', 'json-file');
  file.type = 'file'; file.id = `${side}-json-file`; file.name = `${side}-json-file`;
  file.accept = '.json,.txt,application/json,text/plain';
  const fileHelp = element('p', 'field-help', 'Read only on this device. The file is not uploaded.');
  fileHelp.id = `${side}-json-file-help`; file.setAttribute('aria-describedby', fileHelp.id);
  copyStep.append(jsonLabel, json, fileLabel, file, fileHelp);
  const fallback = element('button', 'text-button api-fallback', 'API blocked? Paste your deck instead →');
  fallback.type = 'button';
  apiPanel.append(openStep, copyStep, fallback);

  const textPanel = element('div', 'source-panel');
  const textLabel = element('label', 'field-label', 'Deck export');
  textLabel.htmlFor = `${side}-text`;
  const text = element('textarea', 'text-input deck-text');
  text.id = `${side}-text`; text.name = `${side}-text`; text.rows = 10;
  text.placeholder = '1 Sol Ring\n4 Forest\n\n1 Leonardo, the Balance\n1 Michelangelo, the Heart';
  text.autocomplete = 'off'; text.spellcheck = false; text.setAttribute('autocapitalize', 'off');
  const help = element('details', 'export-help');
  const steps = element('ol');
  for (const instruction of [
    'Open the deck’s Export menu on Moxfield and copy a text or Arena list.',
    'Paste the mainboard and commanders. A blank line before your commander cards is fine; headings are optional.',
    'Leave sideboards out, or label them Sideboard. Use canonical English card names.',
  ]) steps.append(element('li', '', instruction));
  help.append(element('summary', '', 'How to export your list'), steps);
  textPanel.append(textLabel, text, element('p', 'field-help', 'Include mainboard and commanders. Blank lines are fine. Use one quantity and card name per line.'), help);
  const error = element('div', 'field-error');
  error.id = `${side}-error`; error.setAttribute('role', 'alert'); error.hidden = true;
  const note = element('p', 'import-note'); note.setAttribute('role', 'status');
  const picker = createPreconPicker(side, provider, edited);
  root.append(top, switcher, apiPanel, textPanel, picker.element, error, note);
  let mode: DeckFormValues['mode'] = 'api';
  let fileRead = 0;

  function edited() {
    fileRead += 1; file.value = ''; picker.cancel(); onEdit();
  }

  function clearError() {
    picker.clearError();
    error.hidden = true; error.replaceChildren();
    for (const input of [url, json, text]) {
      input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
    }
  }
  function setMode(next: DeckFormValues['mode'], focus = false) {
    mode = next;
    apiPanel.hidden = next !== 'api'; textPanel.hidden = next !== 'text';
    picker.element.hidden = next !== 'precon'; note.hidden = next === 'precon';
    apiButton.setAttribute('aria-pressed', String(next === 'api'));
    textButton.setAttribute('aria-pressed', String(next === 'text'));
    preconButton.setAttribute('aria-pressed', String(next === 'precon'));
    clearError(); note.textContent = '';
    if (next === 'precon') picker.activate(); else picker.deactivate();
    if (focus) {
      if (next === 'precon') picker.focus(); else (next === 'api' ? url : text).focus();
    }
  }
  function useText() {
    edited();
    if (!text.value.trim() && /^\d+[xX]?\s+/u.test(json.value.trim())) text.value = json.value;
    setMode('text', true);
  }
  function showError(failure: ImportFailure) {
    clearError();
    if (mode === 'precon') { picker.showError(failure); root.classList.remove('is-loading'); return; }
    error.append(element('p', '', failure.message));
    if (failure.issues.length) {
      const list = element('ul');
      for (const issue of failure.issues) list.append(element('li', '', `Line ${issue.line}: ${issue.message}`));
      error.append(list);
    }
    if (mode === 'api' && failure.code !== 'invalid-url') {
      const recovery = element('button', 'text-button', 'Use a pasted deck instead →');
      recovery.type = 'button'; recovery.addEventListener('click', useText); error.append(recovery);
    }
    error.hidden = false;
    const input = mode === 'text' ? text : failure.code === 'invalid-url' ? url : json;
    input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id);
    root.classList.remove('is-loading'); note.textContent = '';
  }
  apiButton.addEventListener('click', () => { edited(); setMode('api', true); });
  textButton.addEventListener('click', useText);
  preconButton.addEventListener('click', () => { edited(); setMode('precon', true); });
  fallback.addEventListener('click', useText);
  openApi.addEventListener('click', () => {
    edited(); clearError();
    try {
      const apiUrl = moxfieldApiUrl(url.value);
      window.open(apiUrl, '_blank', 'noopener,noreferrer');
      note.textContent = 'Copy the JSON from the new tab and paste it here. If it did not open or shows an error, choose Paste deck.';
    } catch (failure) {
      if (failure instanceof ImportFailure) showError(failure);
      url.focus();
    }
  });
  for (const input of [url, json, text]) input.addEventListener('input', () => {
    clearError(); note.textContent = ''; edited();
    if (input === url && json.value) {
      json.value = '';
      note.textContent = 'The link changed. Copy the API response for this deck again.';
    }
  });
  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    edited(); clearError();
    json.value = '';
    const run = fileRead;
    note.textContent = 'Reading the JSON file on this device…';
    void selected.text().then((value) => {
      if (run !== fileRead) return;
      clearError();
      json.value = value;
      try {
        const deck = parseMoxfieldJson(value, url.value);
        note.textContent = `✓ Loaded locally · ${deck.name} · ${deckTotal(deck)} cards. Select Find cards to remove.`;
      } catch (failure) {
        showError(failure instanceof ImportFailure ? failure : new ImportFailure('invalid-json', 'This JSON file could not be read. Try saving the full API response again, or choose Paste deck.'));
      }
    }, () => {
      if (run === fileRead) showError(new ImportFailure('invalid-json', 'This file could not be opened. Choose it again, paste the complete JSON, or choose Paste deck.'));
    });
  });
  setMode('api');

  return {
    element: root,
    read: (): DeckInput => mode === 'api' ? { kind: 'api', value: json.value, url: url.value }
      : mode === 'precon' ? { kind: 'precon', id: picker.id() } : { kind: 'text', value: text.value },
    precon: picker.read,
    values: (): DeckFormValues => ({ mode, url: url.value, json: json.value, text: text.value, preconId: picker.id() }),
    restore(values: DeckFormValues) {
      edited(); url.value = values.url; json.value = values.json; text.value = values.text;
      picker.restore(values.preconId);
      root.classList.remove('is-loading'); setMode(values.mode);
    },
    clearError,
    loading(value: boolean) { note.textContent = value ? 'Reading your list…' : ''; root.classList.toggle('is-loading', value); },
    ready(deck: DeckSnapshot) { note.textContent = `✓ Ready · ${deckTotal(deck)} cards`; root.classList.remove('is-loading'); },
    showError,
    setText(value: string) { edited(); text.value = value; url.value = ''; json.value = ''; setMode('text'); },
    reset() { edited(); url.value = ''; json.value = ''; text.value = ''; picker.reset(); root.classList.remove('is-loading'); setMode('api'); },
    focus() { if (mode === 'precon') picker.focus(); else (mode === 'api' ? url : text).focus(); },
  };
}
