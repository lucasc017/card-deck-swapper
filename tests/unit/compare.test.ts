import { describe, expect, it } from 'vitest';
import { compareDecks } from '../../src/domain/compare';
import { cardKey, normalizeDeck } from '../../src/domain/normalize';
import { parseDeckText } from '../../src/imports/text';
import { originalText, targetText } from '../fixtures/decks';

describe('physical deck comparison', () => {
  it('returns only removals, alphabetically, with the quantity difference', () => {
    expect(compareDecks(parseDeckText(originalText), parseDeckText(targetText))).toEqual([
      { key: 'cultivate', name: 'Cultivate', quantityToRemove: 1 },
      { key: 'forest', name: 'Forest', quantityToRemove: 3 },
      { key: "kodama's reach", name: "Kodama's Reach", quantityToRemove: 1 },
      { key: 'swiftfoot boots', name: 'Swiftfoot Boots', quantityToRemove: 1 },
    ]);
  });
  it('does not turn additions into removals', () => {
    expect(compareDecks(parseDeckText('1 Sol Ring'), parseDeckText('1 Sol Ring\n1 Cultivate'))).toEqual([]);
    expect(compareDecks(parseDeckText('1 Sol Ring\n1 Cultivate'), parseDeckText('1 Sol Ring'))).toHaveLength(1);
  });
  it('returns no removals for the same deck', () => {
    const deck = parseDeckText(originalText);
    expect(compareDecks(deck, deck)).toEqual([]);
  });
  it('aggregates printing variations before subtracting', () => {
    const a = parseDeckText('2 Forest (M21) 274\n3 Forest (M20) 280 *F*');
    expect(compareDecks(a, parseDeckText('4 forest'))[0]?.quantityToRemove).toBe(1);
  });
  it('keeps a card moving between mainboard and commander', () => {
    const a = parseDeckText('Commander\n1 Kenrith, the Returned King\nDeck\n1 Sol Ring');
    const b = parseDeckText('Commander\n1 Sol Ring\nDeck\n1 Kenrith, the Returned King');
    expect(compareDecks(a, b)).toEqual([]);
  });
  it('removes a replaced commander', () => {
    expect(compareDecks(parseDeckText('Commander\n1 Atraxa, Praetors\' Voice'), parseDeckText('Commander\n1 Kenrith, the Returned King'))[0]?.name).toBe("Atraxa, Praetors' Voice");
  });
  it('normalizes Unicode, case and whitespace without fuzzy matching', () => {
    expect(cardKey('  Se\u0301ance  ')).toBe(cardKey('SÉANCE'));
    expect(cardKey(' Sol   Ring ')).toBe('sol ring');
    expect(compareDecks(parseDeckText('1 Sol Ring'), parseDeckText('1 Sol Talisman'))).toHaveLength(1);
  });
  it('preserves split, double-faced, and punctuated names', () => {
    const a = parseDeckText('1 Fire // Ice\n1 Valki, God of Lies // Tibalt, Cosmic Impostor\n1 B.F.M. (Big Furry Monster)');
    expect(compareDecks(a, parseDeckText('1 Fire // Ice')).map((item) => item.name)).toEqual(['B.F.M. (Big Furry Monster)', 'Valki, God of Lies // Tibalt, Cosmic Impostor']);
  });
  it('rejects unsafe quantities at the domain boundary', () => {
    expect(() => normalizeDeck('test', [{ name: 'Forest', quantity: 0 }])).toThrow();
    expect(() => normalizeDeck('test', [{ name: 'Forest', quantity: Number.MAX_SAFE_INTEGER }, { name: 'Forest', quantity: 1 }])).toThrow();
    expect(() => normalizeDeck('test', [{ name: 'Forest', quantity: Number.MAX_SAFE_INTEGER }, { name: 'Island', quantity: 1 }])).toThrow();
  });
});
