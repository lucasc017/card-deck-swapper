import { afterEach, describe, expect, it, vi } from 'vitest';
import { deckTotal } from '../../src/domain/normalize';
import { createPreconProvider, parsePreconCatalog, parsePreconDeck, PRECON_API } from '../../src/imports/precons';
import { preconCatalogPayload, preconEntry, preconPayload } from '../fixtures/precons';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('MTGJSON precon adapter', () => {
  it('keeps physical Commander decks, distinct editions, and newest releases first', () => {
    expect(parsePreconCatalog(preconCatalogPayload).entries.map((entry) => entry.id)).toEqual([
      'IslandAllies_NEW', 'ForestFriends_TST', 'ForestFriendsCollectorSEdition_TST',
    ]);
  });

  it('accepts an unknown release date and sorts it last', () => {
    const entries = parsePreconCatalog({ data: preconCatalogPayload.data.map((entry, index) => index === 0 ? { ...entry, releaseDate: null } : entry) }).entries;
    expect(entries.at(-1)?.id).toBe(preconEntry.id);
  });

  it.each([
    {}, { data: [] }, { data: [null] }, { data: [{ ...preconCatalogPayload.data[0], fileName: '../other' }] },
    { data: [preconCatalogPayload.data[0], preconCatalogPayload.data[0]] },
    { data: [{ ...preconCatalogPayload.data[0], releaseDate: 'yesterday' }] },
  ])('rejects malformed, empty, duplicate, or unsafe catalogs', (payload) => {
    expect(() => parsePreconCatalog(payload)).toThrow();
  });

  it('combines mainboard and partner commanders, aggregates printings, and excludes supplemental cards', () => {
    const { snapshot, commanders } = parsePreconDeck(preconPayload, preconEntry);
    expect(deckTotal(snapshot)).toBe(100);
    expect(snapshot.cards.find((card) => card.name === 'Forest')?.quantity).toBe(94);
    expect(commanders).toEqual(['First Commander', 'Second Commander']);
    expect(snapshot.cards.map((card) => card.name)).toEqual([
      'Forest', 'Cultivate', 'Sol Ring', 'Fire // Ice', 'Westvale Abbey // Ormendahl, Profane Prince', 'First Commander', 'Second Commander',
    ]);
  });

  it.each([
    { name: 'Wrong precon' }, { code: 'BAD' }, { type: 'Starter Kit' }, { mainBoard: [] },
    { commander: [] }, { commander: undefined },
    { mainBoard: [{ name: 'Forest', count: 97 }] },
    { mainBoard: [{ name: '', count: 98 }] },
    { mainBoard: [{ name: 'Forest', count: -1 }] },
    { mainBoard: [{ name: 'Forest', count: 98.5 }] },
    { mainBoard: [{ name: 'Forest', count: '98' }] },
  ])('rejects mismatches, incomplete lists, and invalid quantities', (changes) => {
    expect(() => parsePreconDeck({ data: { ...preconPayload.data, ...changes } }, preconEntry)).toThrow();
  });
});

describe('live precon provider', () => {
  it('loads on demand, caches only validated public data, and omits credentials and referrers', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json(preconCatalogPayload)).mockResolvedValueOnce(Response.json(preconPayload));
    vi.stubGlobal('fetch', request);
    const provider = createPreconProvider();
    const signal = new AbortController().signal;
    expect(request).not.toHaveBeenCalled();
    await provider.loadCatalog(signal); await provider.loadCatalog(signal);
    const deck = await provider.loadDeck(preconEntry, signal);
    expect(await provider.loadDeck(preconEntry, signal)).toBe(deck);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, `${PRECON_API}DeckList.json`, expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache' }));
    expect(request).toHaveBeenNthCalledWith(2, `${PRECON_API}decks/${preconEntry.id}.json`, expect.anything());
  });

  it('does not cache unsuccessful requests or invalid decks, allowing an explicit retry', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ data: { ...preconPayload.data, name: 'Wrong deck' } }))
      .mockResolvedValueOnce(Response.json(preconPayload));
    vi.stubGlobal('fetch', request);
    const provider = createPreconProvider();
    const signal = new AbortController().signal;
    await expect(provider.loadDeck(preconEntry, signal)).rejects.toMatchObject({ code: 'precon-unavailable' });
    await expect(provider.loadDeck(preconEntry, signal)).rejects.toMatchObject({ code: 'invalid-precon' });
    expect(provider.cachedDeck(preconEntry.id)).toBeUndefined();
    await expect(provider.loadDeck(preconEntry, signal)).resolves.toHaveProperty('snapshot');
  });

  it('times out after 15 seconds without background retries', async () => {
    vi.useFakeTimers();
    const request = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', request);
    const pending = createPreconProvider().loadCatalog(new AbortController().signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'precon-unavailable' });
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ignores an aborted response even if the transport still resolves', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const provider = createPreconProvider();
    const controller = new AbortController();
    const pending = provider.loadCatalog(controller.signal);
    controller.abort(); finish(Response.json(preconCatalogPayload));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(provider.cachedCatalog()).toBeNull();
  });
});
