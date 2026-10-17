import { deckTotal, normalizeDeck } from '../domain/normalize';
import { ImportFailure } from '../domain/types';
import type { DeckSnapshot } from '../domain/types';

export const PRECON_API = 'https://mtgjson.com/api/v5/';

export interface PreconEntry {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly releaseDate: string | null;
}

export interface PreconCatalog {
  readonly entries: readonly PreconEntry[];
}

export interface PreconDeck {
  readonly entry: PreconEntry;
  readonly snapshot: DeckSnapshot;
  readonly commanders: readonly string[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalid(message: string): ImportFailure {
  return new ImportFailure('invalid-precon', `${message} Retry, or choose Paste deck to enter the stock list yourself.`);
}

export function parsePreconCatalog(payload: unknown): PreconCatalog {
  const unsupported = () => invalid('MTGJSON returned an unsupported precon catalog.');
  if (!record(payload) || !Array.isArray(payload['data'])) throw unsupported();
  const entries: PreconEntry[] = [];
  const ids = new Set<string>();
  for (const entry of payload['data']) {
    if (!record(entry) || typeof entry['type'] !== 'string') throw unsupported();
    if (entry['type'] !== 'Commander Deck') continue;
    const { fileName, name, code, releaseDate } = entry;
    if (!nonempty(fileName) || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(fileName)
      || !nonempty(name) || !nonempty(code)
      || (releaseDate !== null && (typeof releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(releaseDate)))
      || ids.has(fileName)) throw unsupported();
    ids.add(fileName);
    entries.push({ id: fileName, name, code, releaseDate });
  }
  if (!entries.length) throw unsupported();
  entries.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')
    || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id));
  return { entries };
}

export function parsePreconDeck(payload: unknown, entry: PreconEntry): PreconDeck {
  const unsupported = () => invalid('MTGJSON returned an incomplete or unsupported precon list.');
  if (!record(payload) || !record(payload['data'])) throw unsupported();
  const data = payload['data'];
  if (data['name'] !== entry.name || data['code'] !== entry.code || data['type'] !== 'Commander Deck'
    || !Array.isArray(data['mainBoard']) || !data['mainBoard'].length
    || !Array.isArray(data['commander']) || !data['commander'].length) throw unsupported();
  const cards: { name: string; quantity: number }[] = [];
  const commanders: string[] = [];
  for (const zone of ['mainBoard', 'commander'] as const) {
    for (const card of data[zone] as unknown[]) {
      if (!record(card) || !nonempty(card['name']) || typeof card['count'] !== 'number'
        || !Number.isSafeInteger(card['count']) || card['count'] <= 0) throw unsupported();
      cards.push({ name: card['name'], quantity: card['count'] });
      if (zone === 'commander') commanders.push(card['name']);
    }
  }
  let snapshot: DeckSnapshot;
  try { snapshot = normalizeDeck(entry.name, cards); } catch { throw unsupported(); }
  if (deckTotal(snapshot) !== 100) {
    throw invalid('This stock precon did not contain exactly 100 mainboard and commander cards. No cards were imported.');
  }
  return { entry, snapshot, commanders };
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache',
    });
    if (!response.ok) throw new Error('Provider request failed.');
    const payload: unknown = await response.json();
    signal.throwIfAborted();
    return payload;
  } catch {
    signal.throwIfAborted();
    throw new ImportFailure('precon-unavailable', 'MTGJSON could not be reached or its response could not be read within 15 seconds. Retry, or choose Paste deck to enter the stock list yourself.');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

export function createPreconProvider() {
  let catalog: PreconCatalog | null = null;
  const decks = new Map<string, PreconDeck>();
  return {
    cachedCatalog: () => catalog,
    cachedDeck: (id: string) => decks.get(id),
    async loadCatalog(signal: AbortSignal): Promise<PreconCatalog> {
      signal.throwIfAborted();
      if (catalog) return catalog;
      const loaded = parsePreconCatalog(await fetchJson(`${PRECON_API}DeckList.json`, signal));
      catalog = loaded;
      return loaded;
    },
    async loadDeck(entry: PreconEntry, signal: AbortSignal): Promise<PreconDeck> {
      signal.throwIfAborted();
      const cached = decks.get(entry.id);
      if (cached) return cached;
      const loaded = parsePreconDeck(await fetchJson(`${PRECON_API}decks/${encodeURIComponent(entry.id)}.json`, signal), entry);
      decks.set(entry.id, loaded);
      return loaded;
    },
  };
}

export type PreconProvider = ReturnType<typeof createPreconProvider>;
