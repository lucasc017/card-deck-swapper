import { describe, expect, it } from 'vitest';
import { moxfieldApiUrl, moxfieldDeckId, parseMoxfieldDeck, parseMoxfieldJson } from '../../src/imports/moxfield';
import { deckTotal } from '../../src/domain/normalize';
import { completeCommanderPayload, originalId, originalPayload, originalUrl, targetId, truncatedCommanderJson } from '../fixtures/decks';

describe('Moxfield adapter', () => {
  it('extracts an ID, ignores query/fragment, and permits www', () => {
    expect(moxfieldDeckId(` https://www.moxfield.com/decks/${originalId}/?sort=name#cards `)).toBe(originalId);
  });
  it('accepts an API URL and constructs only the fixed endpoint', () => {
    const api = `https://api2.moxfield.com/v3/decks/all/${originalId}`;
    expect(moxfieldApiUrl(`${originalUrl}?secret=never-forward#cards`)).toBe(api);
    expect(moxfieldApiUrl(`${api}/?sort=name#cards`)).toBe(api);
  });
  it.each([
    'javascript:alert(1)', `http://moxfield.com/decks/${originalId}`, `https://moxfield.com.evil.test/decks/${originalId}`,
    `https://moxfield.com@evil.test/decks/${originalId}`, `https://me:secret@moxfield.com/decks/${originalId}`,
    'https://moxfield.com/decks/not-an-id', `https://moxfield.com:8080/decks/${originalId}`, `https://moxfield.com/decks/${originalId}/history`,
    `https://api2.moxfield.com/decks/${originalId}`, `https://moxfield.com/v3/decks/all/${originalId}`,
    `https://api2.moxfield.com.evil.test/v3/decks/all/${originalId}`,
  ])('rejects an unsafe or invalid URL: %s', (url) => expect(() => moxfieldApiUrl(url)).toThrow());
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
  it('reads pasted JSON with a BOM, with or without its source link', () => {
    const text = `\uFEFF${JSON.stringify(originalPayload)}`;
    expect(parseMoxfieldJson(text, originalUrl)).toEqual(parseMoxfieldDeck(originalPayload));
    expect(deckTotal(parseMoxfieldJson(text))).toBe(10);
  });
  it('reads a full 98-mainboard / 2-commander response, ignoring preview and extra metadata', () => {
    const deck = parseMoxfieldJson(JSON.stringify(completeCommanderPayload), originalUrl);
    expect(deckTotal(deck)).toBe(100);
    expect(deck.cards).toHaveLength(93);
    expect(deck.cards.find((card) => card.name === 'Forest')?.quantity).toBe(4);
    expect(deck.cards.filter((card) => card.name.endsWith('Commander'))).toHaveLength(2);
    expect(deck.cards.some((card) => ['Preview card only', 'Black Lotus', 'Time Walk'].includes(card.name))).toBe(false);
  });
  it('identifies JSON cut off inside card metadata and offers saved-file recovery', () => {
    expect(() => parseMoxfieldJson(truncatedCommanderJson)).toThrow(expect.objectContaining({
      code: 'invalid-json', message: expect.stringContaining('appears cut off'),
    }));
    expect(() => parseMoxfieldJson(truncatedCommanderJson)).toThrow(/JSON file/u);
  });
  it.each(['', ' ', '{"name":', '<html>Forbidden</html>', '1 Sol Ring\n4 Forest'])('reports incomplete or non-JSON input with paste recovery', (text) => {
    expect(() => parseMoxfieldJson(text)).toThrow(expect.objectContaining({ code: 'invalid-json' }));
  });
  it('rejects JSON error responses and never creates a partial deck', () => {
    expect(() => parseMoxfieldJson('{"status":429,"error":"Too many requests"}')).toThrow(expect.objectContaining({ code: 'unsupported-response' }));
  });
  it('checks the public deck ID when present in the response', () => {
    expect(() => parseMoxfieldJson(JSON.stringify({ ...originalPayload, publicId: targetId }), originalUrl)).toThrow(/different deck/u);
    expect(deckTotal(parseMoxfieldJson(JSON.stringify({ ...originalPayload, publicId: originalId }), originalUrl))).toBe(10);
  });
});
