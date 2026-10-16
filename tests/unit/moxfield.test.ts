import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMoxfieldDeck, moxfieldDeckId, parseMoxfieldDeck } from '../../src/imports/moxfield';
import { deckTotal } from '../../src/domain/normalize';
import { originalId, originalPayload, originalUrl } from '../fixtures/decks';

afterEach(() => vi.useRealTimers());

describe('Moxfield adapter', () => {
  it('extracts an ID, ignores query/fragment, and permits www', () => {
    expect(moxfieldDeckId(` https://www.moxfield.com/decks/${originalId}/?sort=name#cards `)).toBe(originalId);
  });
  it.each([
    'javascript:alert(1)', `http://moxfield.com/decks/${originalId}`, `https://moxfield.com.evil.test/decks/${originalId}`,
    `https://moxfield.com@evil.test/decks/${originalId}`, `https://me:secret@moxfield.com/decks/${originalId}`,
    'https://moxfield.com/decks/not-an-id', `https://moxfield.com:8080/decks/${originalId}`, `https://moxfield.com/decks/${originalId}/history`,
  ])('rejects an unsafe or invalid URL: %s', (url) => expect(() => moxfieldDeckId(url)).toThrow());
  it('reads included v3 zones and ignores sideboard/maybeboard', () => {
    const deck = parseMoxfieldDeck(originalPayload);
    expect(deck.name).toBe('Counters & company');
    expect(deckTotal(deck)).toBe(10);
    expect(deck.cards.some((card) => card.name === 'Black Lotus')).toBe(false);
  });
  it('also validates legacy root-level boards', () => {
    expect(deckTotal(parseMoxfieldDeck({ name: 'Legacy', mainboard: { a: { card: { name: 'Sol Ring' }, quantity: 1 } }, commanders: {} }))).toBe(1);
  });
  it.each([
    null, {}, { name: 'No boards' }, { name: 'Missing commander data', boards: { mainboard: { cards: {} } } },
    { name: 'Bad quantity', mainboard: { x: { card: { name: 'Forest' }, quantity: 1.5 } }, commanders: {} },
    { name: 'Empty', mainboard: {}, commanders: {} },
    { name: 'Partial', mainboard: { a: { card: { name: 'Sol Ring' }, quantity: 1 }, b: {} }, commanders: {} },
  ])('rejects unsupported or partial responses', (payload) => expect(() => parseMoxfieldDeck(payload)).toThrow());
  it('uses a fixed endpoint, omits credentials and disables caching', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(originalPayload)));
    await loadMoxfieldDeck(`${originalUrl}?secret=never-forward`, undefined, fetcher);
    expect(fetcher).toHaveBeenCalledWith(`https://api2.moxfield.com/v3/decks/all/${originalId}`, expect.objectContaining({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }));
  });
  it.each([403, 404, 429, 500])('reports HTTP %s with paste recovery', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }));
    await expect(loadMoxfieldDeck(originalUrl, undefined, fetcher)).rejects.toMatchObject({ code: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports browser network/CORS failures', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(loadMoxfieldDeck(originalUrl, undefined, fetcher)).rejects.toMatchObject({ code: 'network' });
  });
  it('rejects successful responses containing HTML instead of JSON', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Challenge</html>'));
    await expect(loadMoxfieldDeck(originalUrl, undefined, fetcher)).rejects.toMatchObject({ code: 'unsupported-response' });
  });
  it('cancels requests and rejects even a late successful response', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); return new Response(JSON.stringify(originalPayload)); });
    await expect(loadMoxfieldDeck(originalUrl, controller.signal, fetcher)).rejects.toMatchObject({ code: 'aborted' });
  });
  it('times out after 15 seconds', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const assertion = expect(loadMoxfieldDeck(originalUrl, undefined, fetcher)).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
