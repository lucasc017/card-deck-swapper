export const originalId = 'oEWXWHM5eEGMmopExLWRCA';
export const targetId = 'AE1jTDIDo0SYAabXyD3ajw';
export const originalUrl = `https://moxfield.com/decks/${originalId}`;
export const targetUrl = `https://www.moxfield.com/decks/${targetId}`;

export const separatedCommanderText = `1 Dark Leo & Shredder
1 April O'Neil, Live on the Scene
4 Forest
2 Island

1 Leonardo, the Balance
1 Michelangelo, the Heart`;

export const originalText = `Commander
1 Atraxa, Praetors' Voice

Deck
1 Swiftfoot Boots (CMM) 413 *F*
5 Forest (M21) 274
1 Cultivate
1 Sol Ring
1 Kodama's Reach

Sideboard
1 Black Lotus`;

export const targetText = `Commander
1 Atraxa, Praetors' Voice

Deck
2 Forest
1 Sol Ring
1 Swords to Plowshares`;

export function moxfieldFixture(
  name: string,
  main: readonly (readonly [string, number])[],
  commanders: readonly (readonly [string, number])[] = [["Atraxa, Praetors' Voice", 1]],
) {
  const board = (entries: readonly (readonly [string, number])[]) => ({
    cards: Object.fromEntries(entries.map(([cardName, quantity], index) => [String(index), {
      quantity, card: { name: cardName, set: 'CMM', cn: '123' },
    }])),
  });
  return {
    name,
    boards: {
      mainboard: board(main), commanders: board(commanders),
      sideboard: board([['Black Lotus', 1]]), maybeboard: board([['Time Walk', 1]]),
    },
  };
}

export const originalPayload = moxfieldFixture('Counters & company', [
  ['Swiftfoot Boots', 1], ['Forest', 5], ['Cultivate', 1], ['Sol Ring', 1], ["Kodama's Reach", 1],
]);
export const targetPayload = moxfieldFixture('The next chapter', [
  ['Forest', 2], ['Sol Ring', 1], ['Swords to Plowshares', 1],
]);
