import { createAliasRegistry } from '../domain/aliases';
import type { AliasRegistry, CardAlias } from '../domain/aliases';
import { cardKey } from '../domain/normalize';
import { ImportFailure } from '../domain/types';

export const ALIAS_QUERY = 'is:flavorname lang:en game:paper';
export const ALIAS_API = 'https://api.scryfall.com/cards/search';
export const ALIAS_URL = `${ALIAS_API}?${new URLSearchParams({ q: ALIAS_QUERY, unique: 'prints', include_variations: 'true', order: 'name' })}`;

interface AliasPage {
  readonly aliases: readonly CardAlias[];
  readonly count: number;
  readonly total: number;
  readonly next: string | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function oracleId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(value);
}

function invalid(): ImportFailure {
  return new ImportFailure('invalid-aliases', 'Scryfall returned an incomplete or unsupported alternate-name catalog. Retry before comparing.');
}

export function parseAliasPage(payload: unknown): AliasPage {
  if (!record(payload) || payload['object'] !== 'list' || !Array.isArray(payload['data']) || !payload['data'].length
    || typeof payload['has_more'] !== 'boolean' || typeof payload['total_cards'] !== 'number'
    || !Number.isSafeInteger(payload['total_cards']) || payload['total_cards'] < payload['data'].length) throw invalid();
  const aliases: CardAlias[] = [];
  for (const card of payload['data']) {
    if (!record(card) || !nonempty(card['name']) || card['lang'] !== 'en') throw invalid();
    const first = aliases.length;
    if (nonempty(card['flavor_name'])) {
      if (!oracleId(card['oracle_id'])) throw invalid();
      aliases.push({ alias: card['flavor_name'], name: card['name'], oracleId: card['oracle_id'] });
    }
    if (card['card_faces'] !== undefined) {
      if (!Array.isArray(card['card_faces']) || card['card_faces'].length < 2) throw invalid();
      const faces: { name: string; title: string; oracleId?: string }[] = [];
      for (const face of card['card_faces']) {
        if (!record(face) || !nonempty(face['name'])
          || (face['flavor_name'] !== undefined && !nonempty(face['flavor_name']))) throw invalid();
        faces.push({ name: face['name'], title: nonempty(face['flavor_name']) ? face['flavor_name'] : face['name'],
          ...(oracleId(face['oracle_id']) ? { oracleId: face['oracle_id'] } : {}),
        });
      }
      const face = faces[0];
      if (card['layout'] === 'reversible_card') {
        // Reversible treatments print the same rules identity on both sides.
        if (!face?.oracleId || faces.some((other) => other.oracleId !== face.oracleId || cardKey(other.name) !== cardKey(face.name))) throw invalid();
        for (const other of faces) aliases.push({ alias: other.title, name: face.name, oracleId: face.oracleId });
        aliases.push({ alias: card['name'], name: face.name, oracleId: face.oracleId },
          { alias: faces.map((other) => other.title).join(' // '), name: face.name, oracleId: face.oracleId });
      } else {
        // A transform/split card keeps its complete identity; a lone face is not an alias for it.
        if (!oracleId(card['oracle_id'])) throw invalid();
        aliases.push({ alias: faces.map((other) => other.title).join(' // '), name: card['name'], oracleId: card['oracle_id'] });
      }
    }
    if (aliases.length === first) throw invalid();
  }
  let next: string | null = null;
  if (payload['has_more']) {
    if (typeof payload['next_page'] !== 'string') throw invalid();
    try {
      const url = new URL(payload['next_page']);
      if (url.origin !== 'https://api.scryfall.com' || url.pathname !== '/cards/search' || url.username || url.password
        || url.searchParams.get('q') !== ALIAS_QUERY || url.searchParams.get('unique') !== 'prints'
        || url.searchParams.get('include_variations') !== 'true') throw invalid();
      next = url.href;
    } catch { throw invalid(); }
  }
  return { aliases, count: payload['data'].length, total: payload['total_cards'], next };
}

async function fetchPage(url: string, signal: AbortSignal): Promise<AliasPage> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Provider request failed.');
    const payload: unknown = await response.json();
    signal.throwIfAborted();
    return parseAliasPage(payload);
  } catch (failure) {
    signal.throwIfAborted();
    if (failure instanceof ImportFailure) throw failure;
    throw new ImportFailure('aliases-unavailable', 'Scryfall could not load alternate card names within 15 seconds. Retry before comparing; no name-only comparison was created.');
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel);
  }
}

function pause(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 150);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

export function createAliasProvider() {
  let cached: AliasRegistry | null = null;
  return {
    async load(signal: AbortSignal): Promise<AliasRegistry> {
      signal.throwIfAborted();
      if (cached) return cached;
      const aliases: CardAlias[] = [];
      const visited = new Set<string>();
      let next: string | null = ALIAS_URL;
      let total: number | null = null;
      let count = 0;
      while (next) {
        if (visited.has(next)) throw invalid();
        visited.add(next);
        const page = await fetchPage(next, signal);
        if (total !== null && page.total !== total) throw invalid();
        total = page.total; count += page.count;
        if (count > total) throw invalid();
        aliases.push(...page.aliases); next = page.next;
        if (next) await pause(signal);
      }
      signal.throwIfAborted();
      if (count !== total) throw invalid();
      cached = createAliasRegistry(aliases);
      return cached;
    },
  };
}
