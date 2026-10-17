import { afterEach, describe, expect, it, vi } from 'vitest';
import { AliasConflict, createAliasRegistry, resolveDeckAliases } from '../../src/domain/aliases';
import { compareDecks } from '../../src/domain/compare';
import { cardLabel, deckTotal, normalizeDeck } from '../../src/domain/normalize';
import { ALIAS_QUERY, ALIAS_URL, createAliasProvider, parseAliasPage } from '../../src/imports/aliases';
import { parseMoxfieldDeck } from '../../src/imports/moxfield';
import { parsePreconDeck } from '../../src/imports/precons';
import { parseDeckText } from '../../src/imports/text';
import { aliasPayload, slimeAliasCard, slimeOracleId, turtleAliasText, turtleEntry, turtlePayload } from '../fixtures/aliases';
import { moxfieldFixture } from '../fixtures/decks';

const registry = createAliasRegistry(parseAliasPage(aliasPayload).aliases);
const pageTwo = `${ALIAS_URL}&page=2`;
const firstPage = { ...aliasPayload, total_cards: 3, has_more: true, next_page: pageTwo, data: [slimeAliasCard] };
const secondPage = { ...aliasPayload, data: aliasPayload.data.slice(1) };

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('canonical card identity', () => {
  it('matches the Turtle Power retitle for text, guided JSON, saved JSON, and reverse comparisons', () => {
    const stock = parsePreconDeck(turtlePayload, turtleEntry).snapshot;
    const text = parseDeckText(turtleAliasText);
    const json = parseMoxfieldDeck(moxfieldFixture('Upgraded', [['Forest', 97], ['Sol Ring', 1], ['Marauding Mutagen', 1]], [['Leonardo, the Balance', 1]]));
    for (const imported of [text, json, parseMoxfieldDeck(JSON.parse(JSON.stringify(moxfieldFixture('Saved', [['Marauding Mutagen', 1]], []))))]) {
      expect(compareDecks(imported, stock, registry)).toEqual([]);
      expect(compareDecks(stock, imported, registry).some((item) => item.key === 'acidic slime')).toBe(false);
    }
    expect(deckTotal(stock)).toBe(100);
    expect(stock.cards.find((card) => card.name === 'Acidic Slime')?.printedNames).toEqual(['Marauding Mutagen']);
  });

  it('matches aliases between two custom lists without a selected precon', () => {
    expect(compareDecks(parseDeckText('1 Marauding Mutagen'), parseDeckText('1 Acidic Slime'), registry)).toEqual([]);
    expect(compareDecks(parseDeckText('1 Acidic Slime'), parseDeckText('1 Marauding Mutagen'), registry)).toEqual([]);
  });

  it('aggregates mixed titles by identity and preserves real quantities and labels', () => {
    const original = parseDeckText('2 Marauding Mutagen\n1 Acidic Slime\n1 Steelbane Hydra');
    const items = compareDecks(original, parseDeckText('1 acidic slime'), registry);
    expect(items).toEqual([
      { key: 'acidic slime', name: 'Acidic Slime', printedNames: ['Marauding Mutagen', 'Acidic Slime'], quantityToRemove: 2 },
      { key: 'steelbane hydra', name: 'Steelbane Hydra', quantityToRemove: 1 },
    ]);
    expect(cardLabel(items[0]!)).toBe('Marauding Mutagen (Acidic Slime)');
    expect(cardLabel(items[1]!)).toBe('Steelbane Hydra');
    expect(deckTotal(resolveDeckAliases(original, registry))).toBe(deckTotal(original));
  });

  it('retains several alternate titles in one removal row', () => {
    const aliases = createAliasRegistry([
      { alias: 'Spacegodzilla, Death Corona', name: 'Void Beckoner' },
      { alias: 'Spacegodzilla, Void Invader', name: 'Void Beckoner' },
    ]);
    const items = compareDecks(parseDeckText('1 Spacegodzilla, Death Corona\n1 Spacegodzilla, Void Invader'), parseDeckText('1 Forest'), aliases);
    expect(items).toHaveLength(1);
    expect(items[0]?.quantityToRemove).toBe(2);
    expect(cardLabel(items[0]!)).toBe('Spacegodzilla, Death Corona / Spacegodzilla, Void Invader (Void Beckoner)');
  });

  it('keeps metadata through normalization and uses original printing labels only', () => {
    const stock = parsePreconDeck(turtlePayload, turtleEntry).snapshot;
    const normalized = normalizeDeck(stock.name, stock.cards);
    expect(compareDecks(normalized, parseDeckText('1 Forest'), registry).map(cardLabel)).toContain('Marauding Mutagen (Acidic Slime)');
    expect(compareDecks(parseDeckText('1 Acidic Slime'), parseDeckText('1 Forest\n1 Slash Clone'), registry).map(cardLabel)).toEqual(['Acidic Slime']);
    expect(resolveDeckAliases(resolveDeckAliases(parseDeckText('1 Marauding Mutagen'), registry), registry)).toEqual(resolveDeckAliases(parseDeckText('1 Marauding Mutagen'), registry));
  });

  it('supplements the public registry with precon metadata without changing the shared registry', () => {
    const empty = createAliasRegistry([]);
    const stock = parsePreconDeck(turtlePayload, turtleEntry).snapshot;
    expect(compareDecks(parseDeckText('1 Marauding Mutagen'), stock, empty)).toEqual([]);
    expect(empty.size).toBe(0);
  });

  it('rejects conflicting mappings only when the input uses the affected name', () => {
    const conflict = createAliasRegistry([{ alias: 'Marauding Mutagen', name: 'Sol Ring' }], registry);
    expect(() => compareDecks(parseDeckText('1 Marauding Mutagen'), parseDeckText('1 Forest'), conflict)).toThrow(AliasConflict);
    expect(compareDecks(parseDeckText('1 Island'), parseDeckText('1 Forest'), conflict)).toHaveLength(1);
  });

  it('does not fuzzy-match typos or merge similarly named cards', () => {
    expect(compareDecks(parseDeckText('1 Marauding Mutagen'), parseDeckText('1 Marauding Mutagens'), registry)).toHaveLength(1);
    expect(compareDecks(parseDeckText('1 Sol Ring'), parseDeckText('1 Sol Talisman'), registry)).toHaveLength(1);
  });
});

describe('Scryfall alias adapter', () => {
  it('reads the official canonical, flavor title, and rules identity fields', () => {
    expect(parseAliasPage(aliasPayload).aliases[0]).toEqual({ alias: 'Marauding Mutagen', name: 'Acidic Slime', oracleId: slimeOracleId });
  });

  it('resolves reversible treatments from face identities, not their doubled root name', () => {
    const id = '10000000-0000-0000-0000-000000000001';
    const payload = { ...aliasPayload, total_cards: 1, data: [{ name: 'Birds of Paradise // Birds of Paradise', lang: 'en', layout: 'reversible_card', oracle_id: null,
      card_faces: [{ name: 'Birds of Paradise', flavor_name: 'African Swallow', oracle_id: id }, { name: 'Birds of Paradise', flavor_name: 'European Swallow', oracle_id: id }],
    }] };
    const aliases = createAliasRegistry(parseAliasPage(payload).aliases);
    for (const title of ['African Swallow', 'European Swallow', 'African Swallow // European Swallow', 'Birds of Paradise // Birds of Paradise']) {
      expect(compareDecks(parseDeckText(`1 ${title}`), parseDeckText('1 Birds of Paradise'), aliases)).toEqual([]);
    }
  });

  it('keeps genuine multi-face cards whole and never turns a single face into the whole card', () => {
    const payload = { ...aliasPayload, total_cards: 1, data: [{ name: 'Front // Back', lang: 'en', layout: 'transform', oracle_id: slimeOracleId,
      card_faces: [{ name: 'Front', flavor_name: 'Alternate Front' }, { name: 'Back', flavor_name: 'Alternate Back' }],
    }] };
    const aliases = createAliasRegistry(parseAliasPage(payload).aliases);
    expect(compareDecks(parseDeckText('1 Alternate Front // Alternate Back'), parseDeckText('1 Front // Back'), aliases)).toEqual([]);
    expect(compareDecks(parseDeckText('1 Alternate Front'), parseDeckText('1 Front // Back'), aliases)).toHaveLength(1);
  });

  it.each([
    {}, { ...aliasPayload, data: [] }, { ...aliasPayload, total_cards: 2 },
    { ...aliasPayload, data: [{ ...slimeAliasCard, oracle_id: null }] },
    { ...firstPage, next_page: 'https://example.com/cards/search' },
    { ...firstPage, next_page: pageTwo.replace('unique=prints', 'unique=cards') },
    { ...firstPage, next_page: `${ALIAS_URL.replace(new URL(ALIAS_URL).search, '')}?q=private-deck&unique=prints&include_variations=true` },
  ])('rejects malformed metadata and unsafe pagination', (payload) => {
    expect(() => parseAliasPage(payload)).toThrow();
  });
});

describe('live alias catalog', () => {
  it('fetches every page at least 150 ms apart, sends only a fixed public query, and caches the complete result', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValueOnce(Response.json(firstPage)).mockResolvedValueOnce(Response.json(secondPage));
    vi.stubGlobal('fetch', request);
    const provider = createAliasProvider();
    const signal = new AbortController().signal;
    expect(request).not.toHaveBeenCalled();
    const pending = provider.load(signal);
    await vi.advanceTimersByTimeAsync(149);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const loaded = await pending;
    expect(await provider.load(signal)).toBe(loaded);
    expect(request).toHaveBeenCalledTimes(2);
    expect(new URL(request.mock.calls[0]![0] as string).searchParams.get('q')).toBe(ALIAS_QUERY);
    expect(request).toHaveBeenCalledWith(ALIAS_URL, expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
  });

  it('never caches a partial catalog when a later page fails, and retries from the beginning', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValueOnce(Response.json(firstPage)).mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(Response.json(aliasPayload));
    vi.stubGlobal('fetch', request);
    const provider = createAliasProvider();
    const signal = new AbortController().signal;
    const pending = provider.load(signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'aliases-unavailable' });
    await vi.advanceTimersByTimeAsync(150); await rejected;
    await provider.load(signal);
    expect(request.mock.calls.map((call) => call[0])).toEqual([ALIAS_URL, pageTwo, ALIAS_URL]);
  });

  it('rejects a truncated dataset even when all returned pages individually validate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...aliasPayload, total_cards: 4 })));
    await expect(createAliasProvider().load(new AbortController().signal)).rejects.toMatchObject({ code: 'invalid-aliases' });
  });

  it('aborts obsolete pagination and does not cache the unfinished dataset', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValueOnce(Response.json(firstPage)).mockResolvedValueOnce(Response.json(aliasPayload));
    vi.stubGlobal('fetch', request);
    const provider = createAliasProvider();
    const controller = new AbortController();
    const pending = provider.load(controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(50); controller.abort(); await rejected;
    await provider.load(new AbortController().signal);
    expect(request.mock.calls.map((call) => call[0])).toEqual([ALIAS_URL, ALIAS_URL]);
  });

  it('times out without background retries', async () => {
    vi.useFakeTimers();
    const request = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', request);
    const pending = createAliasProvider().load(new AbortController().signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'aliases-unavailable' });
    await vi.advanceTimersByTimeAsync(15_000); await rejected;
    expect(request).toHaveBeenCalledTimes(1);
  });
});
