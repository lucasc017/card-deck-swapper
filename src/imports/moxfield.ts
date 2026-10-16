import { normalizeDeck } from '../domain/normalize';
import { ImportFailure } from '../domain/types';
import type { DeckSnapshot } from '../domain/types';

export const MOXFIELD_API = 'https://api2.moxfield.com/v3/decks/all/';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function moxfieldDeckId(input: string): string {
  try {
    const url = new URL(input.trim());
    const match = /^\/decks\/([A-Za-z0-9_-]{22})\/?$/u.exec(url.pathname);
    if (url.protocol !== 'https:' || !['moxfield.com', 'www.moxfield.com'].includes(url.hostname)
      || url.username || url.password || url.port || !match?.[1]) throw new Error();
    return match[1];
  } catch {
    throw new ImportFailure('invalid-url', 'Use a Moxfield deck link, such as https://moxfield.com/decks/ followed by the deck ID.');
  }
}

export function parseMoxfieldDeck(payload: unknown): DeckSnapshot {
  const unsupported = () => new ImportFailure('unsupported-response', 'Moxfield returned a deck format this app could not safely read. Please use a pasted export.');
  if (!record(payload) || typeof payload['name'] !== 'string' || !payload['name'].trim()) throw unsupported();
  const version3 = record(payload['boards']);
  const boards = version3 ? payload['boards'] : payload;
  if (!record(boards)) throw unsupported();
  const entries: { name: string; quantity: number }[] = [];
  for (const zone of ['mainboard', 'commanders']) {
    const board = boards[zone];
    if (!record(board)) throw unsupported();
    const cards = version3 ? board['cards'] : board;
    if (!record(cards)) throw unsupported();
    for (const entry of Object.values(cards)) {
      if (!record(entry) || !record(entry['card']) || typeof entry['card']['name'] !== 'string'
        || !entry['card']['name'].trim() || typeof entry['quantity'] !== 'number'
        || !Number.isSafeInteger(entry['quantity']) || entry['quantity'] <= 0) throw unsupported();
      entries.push({ name: entry['card']['name'], quantity: entry['quantity'] });
    }
  }
  if (!entries.length) throw unsupported();
  try { return normalizeDeck(payload['name'], entries); } catch { throw unsupported(); }
}

export async function loadMoxfieldDeck(
  input: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<DeckSnapshot> {
  const id = moxfieldDeckId(input);
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) throw new ImportFailure('aborted', 'Import cancelled.');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
  try {
    const response = await fetcher(`${MOXFIELD_API}${id}`, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const message = response.status === 429
        ? 'Moxfield is limiting requests. Try again later or use a pasted export.'
        : `Moxfield did not allow this import (HTTP ${response.status}). The deck may be private or direct access may be blocked. Use a pasted export.`;
      throw new ImportFailure('unavailable', message);
    }
    let payload: unknown;
    try { payload = await response.json(); } catch {
      if (controller.signal.aborted) throw new Error('aborted');
      throw new ImportFailure('unsupported-response', 'Moxfield did not return readable deck data. Please use a pasted export.');
    }
    if (controller.signal.aborted) throw new Error('aborted');
    return parseMoxfieldDeck(payload);
  } catch (error) {
    if (timedOut) throw new ImportFailure('timeout', 'Moxfield took too long to respond. Try again or use a pasted export.');
    if (signal?.aborted) throw new ImportFailure('aborted', 'Import cancelled.');
    if (error instanceof ImportFailure) throw error;
    throw new ImportFailure('network', 'Could not reach Moxfield. Your connection or Moxfield’s browser access rules may be blocking the request. Use a pasted export.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
