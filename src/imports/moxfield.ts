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
    const deckHost = ['moxfield.com', 'www.moxfield.com'].includes(url.hostname);
    const apiHost = url.hostname === 'api2.moxfield.com';
    const match = (deckHost ? /^\/decks\/([A-Za-z0-9_-]{22})\/?$/u
      : /^\/v3\/decks\/all\/([A-Za-z0-9_-]{22})\/?$/u).exec(url.pathname);
    if (url.protocol !== 'https:' || (!deckHost && !apiHost)
      || url.username || url.password || url.port || !match?.[1]) throw new Error();
    return match[1];
  } catch {
    throw new ImportFailure('invalid-url', 'Use a Moxfield deck link, such as https://moxfield.com/decks/ followed by the deck ID.');
  }
}

export function moxfieldApiUrl(input: string): string {
  return `${MOXFIELD_API}${moxfieldDeckId(input)}`;
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

export function parseMoxfieldJson(text: string, sourceUrl = ''): DeckSnapshot {
  const expectedId = sourceUrl.trim() ? moxfieldDeckId(sourceUrl) : undefined;
  const json = text.trim();
  if (!json) {
    throw new ImportFailure('invalid-json', 'Open the API response, copy the full JSON, and paste it below. If the API is blocked, choose Paste deck.');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(json) as unknown;
  } catch {
    if (json.startsWith('{') && !json.endsWith('}')) {
      throw new ImportFailure('invalid-json', 'This JSON appears cut off before the end of the response. Save the complete API response as a JSON file and choose it below, or copy all of the raw JSON. No cards were imported.');
    }
    throw new ImportFailure('invalid-json', 'This is not valid JSON. In the API tab, use the JSON viewer’s Copy or Save option, or select all of the raw response. You can choose a saved JSON file below. For a card list or an API error page, choose Paste deck instead.');
  }
  if (expectedId && record(payload) && typeof payload['publicId'] === 'string' && payload['publicId'] !== expectedId) {
    throw new ImportFailure('unsupported-response', 'This JSON belongs to a different deck. Open the response for the link above and paste it again, or update the link.');
  }
  return parseMoxfieldDeck(payload);
}
