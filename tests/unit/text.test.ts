import { describe, expect, it } from 'vitest';
import { parseDeckText } from '../../src/imports/text';
import { ImportFailure } from '../../src/domain/types';
import { deckTotal } from '../../src/domain/normalize';
import { originalText } from '../fixtures/decks';

describe('text imports', () => {
  it('includes commanders and mainboard but excludes other zones', () => {
    const deck = parseDeckText(`${originalText}\nConsidering\n2 Time Walk\nTokens\n1 Soldier`);
    expect(deckTotal(deck)).toBe(10);
    expect(deck.cards.some((card) => ['Black Lotus', 'Time Walk', 'Soldier'].includes(card.name))).toBe(false);
  });
  it('accepts CRLF, BOM, bracketed and commented section headings', () => {
    const deck = parseDeckText('\uFEFF// COMMANDER\r\n1 Atraxa, Praetors\' Voice\r\n\r\n[Mainboard]\r\n1x Sol Ring (CMM) 396 *F* *CMDR*\r\n[Sideboard]\r\n1 Black Lotus');
    expect(deck.cards.map((card) => card.name)).toEqual(["Atraxa, Praetors' Voice", 'Sol Ring']);
  });
  it('supports a single unlabeled block, including duplicate printings', () => {
    const deck = parseDeckText('\n1 Sol Ring\n2x Forest\n3 Forest (M21) 274 *F*\n');
    expect(deck.cards.find((card) => card.key === 'forest')?.quantity).toBe(5);
  });
  it('rejects multiple unlabeled blocks instead of guessing the sideboard', () => {
    expect(() => parseDeckText('1 Sol Ring\n\n1 Black Lotus')).toThrow(/small fix/u);
  });
  it('reports line numbers and rejects the entire malformed list', () => {
    try { parseDeckText('Deck\n1 Sol Ring\nnot a card line\n0 Forest'); expect.fail('Expected an import failure'); }
    catch (error) {
      expect(error).toBeInstanceOf(ImportFailure);
      if (error instanceof ImportFailure) expect(error.issues.map((issue) => issue.line)).toEqual([3, 4]);
    }
  });
  it.each(['', '   ', 'Sideboard\n1 Sol Ring', 'Deck\n0 Forest', 'Deck\n1.5 Forest', 'Deck\n-1 Forest', 'Deck\n9007199254740992 Forest'])('rejects empty or invalid content: %s', (text) => {
    expect(() => parseDeckText(text)).toThrow(ImportFailure);
  });
  it('does not impose a 100-card legality check', () => {
    expect(deckTotal(parseDeckText('1 Sol Ring'))).toBe(1);
  });
  it('does not treat a card-name parenthesis as printing metadata', () => {
    expect(parseDeckText('1 B.F.M. (Big Furry Monster)').cards[0]?.name).toBe('B.F.M. (Big Furry Monster)');
  });
});
