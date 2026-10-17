import { deckTotal } from '../domain/normalize';
import { ImportFailure } from '../domain/types';
import type { DeckSide } from '../domain/types';
import type { PreconCatalog, PreconDeck, PreconProvider } from '../imports/precons';
import { element } from './status';

export function createPreconPicker(side: DeckSide, provider: PreconProvider, onEdit: () => void) {
  const root = element('div', 'source-panel precon-panel');
  const searchLabel = element('label', 'field-label', 'Search Commander precons');
  const search = element('input', 'text-input');
  search.type = 'search'; search.id = `${side}-precon-search`; search.autocomplete = 'off';
  search.placeholder = 'Deck name or set code'; searchLabel.htmlFor = search.id;
  const selectLabel = element('label', 'field-label', 'Stock precon');
  const select = element('select', 'text-input precon-select');
  select.id = `${side}-precon`; select.name = `${side}-precon`; selectLabel.htmlFor = select.id;
  const status = element('p', 'import-note');
  status.id = `${side}-precon-status`; status.setAttribute('role', 'status');
  const preview = element('p', 'precon-preview');
  preview.id = `${side}-precon-preview`;
  const error = element('div', 'field-error');
  error.id = `${side}-precon-error`; error.setAttribute('role', 'alert'); error.hidden = true;
  const attribution = element('p', 'field-help');
  const link = element('a', '', 'MTGJSON');
  link.href = 'https://mtgjson.com/downloads/all-decks/'; link.target = '_blank'; link.rel = 'noopener noreferrer';
  attribution.append('Stock decklists from ', link, '. Loaded live; only this selection is downloaded.');
  root.append(searchLabel, search, selectLabel, select, status, preview, error, attribution);

  let active = false;
  let generation = 0;
  let selectedId = '';
  let catalog: PreconCatalog | null = provider.cachedCatalog();
  let catalogWork: { controller: AbortController; promise: Promise<PreconCatalog> } | null = null;
  let deckWork: { controller: AbortController; id: string; promise: Promise<PreconDeck> } | null = null;

  function clearError() {
    error.hidden = true; error.replaceChildren();
    select.removeAttribute('aria-invalid'); select.removeAttribute('aria-describedby');
  }

  function renderOptions() {
    const query = search.value.trim().toLocaleLowerCase('en-US');
    const matches = catalog?.entries.filter((entry) => `${entry.name} ${entry.code}`.toLocaleLowerCase('en-US').includes(query)) ?? [];
    select.replaceChildren(element('option', '', catalog ? 'Choose a stock precon…' : 'Loading precons…'));
    const placeholder = select.options[0];
    if (placeholder) placeholder.value = '';
    // Keep the explicit selection visible even when a new search does not match it.
    const selected = catalog?.entries.find((entry) => entry.id === selectedId);
    if (selected && !matches.includes(selected)) matches.unshift(selected);
    for (const entry of matches) {
      const option = element('option', '', `${entry.name} · ${entry.code}${entry.releaseDate ? ` · ${entry.releaseDate.slice(0, 4)}` : ''}`);
      option.value = entry.id; select.append(option);
    }
    select.value = selectedId;
    select.disabled = !catalog;
    if (catalog) status.textContent = matches.length ? `${matches.length} precons available. Choose the stock list; import your upgraded list in the other panel.` : 'No precons match this search.';
  }

  function displayDeck(deck: PreconDeck) {
    preview.textContent = `${deck.snapshot.name} · ${deckTotal(deck.snapshot)} cards. Commanders: ${deck.commanders.join('; ')}.`;
    status.textContent = '✓ Stock precon ready. Select Find cards to remove when your other list is ready.';
  }

  function ensureCatalog(): Promise<PreconCatalog> {
    catalog = provider.cachedCatalog();
    if (catalog) { renderOptions(); return Promise.resolve(catalog); }
    if (catalogWork) return catalogWork.promise;
    const run = generation;
    const controller = new AbortController();
    status.textContent = 'Loading Commander precons from MTGJSON…';
    const promise = provider.loadCatalog(controller.signal).then((loaded) => {
      if (run === generation && active) { catalog = loaded; renderOptions(); }
      return loaded;
    }).finally(() => {
      if (catalogWork?.controller === controller) catalogWork = null;
    });
    catalogWork = { controller, promise };
    return promise;
  }

  async function loadSelection(): Promise<PreconDeck> {
    const run = generation;
    const id = selectedId;
    if (!id) throw new ImportFailure('invalid-precon', 'Choose a stock precon from the list first.');
    const available = await ensureCatalog();
    if (run !== generation || !active) throw new DOMException('Selection changed.', 'AbortError');
    const entry = available.entries.find((candidate) => candidate.id === id);
    if (!entry) throw new ImportFailure('invalid-precon', 'This precon is no longer in the catalog. Choose another stock list.');
    const cached = provider.cachedDeck(id);
    if (cached) { displayDeck(cached); return cached; }
    if (deckWork?.id === id) return deckWork.promise;
    const controller = new AbortController();
    status.textContent = 'Loading the selected stock deck from MTGJSON…';
    const promise = provider.loadDeck(entry, controller.signal).then((deck) => {
      if (run === generation && active && selectedId === id) displayDeck(deck);
      return deck;
    }).finally(() => {
      if (deckWork?.controller === controller) deckWork = null;
    });
    deckWork = { controller, id, promise };
    return promise;
  }

  function showError(failure: ImportFailure) {
    clearError(); status.textContent = '';
    error.append(element('p', '', failure.message)); error.hidden = false;
    select.setAttribute('aria-invalid', 'true'); select.setAttribute('aria-describedby', error.id);
    if (failure.code === 'precon-unavailable' || !catalog || selectedId) {
      const retry = element('button', 'text-button', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', () => { onEdit(); clearError(); activate(); });
      error.append(retry);
    }
  }

  function report(failure: unknown, run: number) {
    if (run !== generation || !active) return;
    showError(failure instanceof ImportFailure ? failure : new ImportFailure('precon-unavailable', 'The precon could not be loaded. Retry, or choose Paste deck.'));
  }

  function activate() {
    active = true;
    const run = generation;
    void ensureCatalog().then(async () => {
      if (run === generation && active && selectedId) await loadSelection();
    }).catch((failure: unknown) => report(failure, run));
  }

  function cancel() {
    generation += 1;
    catalogWork?.controller.abort(); deckWork?.controller.abort();
    catalogWork = null; deckWork = null;
    status.textContent = '';
  }

  search.addEventListener('input', renderOptions);
  select.addEventListener('change', () => {
    const id = select.value;
    onEdit(); selectedId = id; preview.textContent = ''; clearError();
    const run = generation;
    if (id) void loadSelection().catch((failure: unknown) => report(failure, run));
  });
  renderOptions();

  return {
    element: root,
    activate,
    cancel,
    deactivate() { cancel(); active = false; },
    clearError,
    showError,
    id: () => selectedId,
    async read() { return (await loadSelection()).snapshot; },
    restore(id: string) {
      cancel(); selectedId = id; search.value = ''; preview.textContent = '';
      catalog = provider.cachedCatalog(); renderOptions();
      const deck = provider.cachedDeck(id);
      if (deck) displayDeck(deck);
    },
    reset() {
      cancel(); selectedId = ''; search.value = ''; preview.textContent = ''; clearError(); renderOptions();
    },
    focus() { search.focus(); },
  };
}
