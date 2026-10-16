import type { CardQuantity, DeckSnapshot } from './types';

export function displayName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export function cardKey(name: string): string {
  return displayName(name).toLocaleLowerCase('en-US');
}

export function normalizeDeck(
  name: string,
  entries: readonly { readonly name: string; readonly quantity: number }[],
): DeckSnapshot {
  const cards = new Map<string, CardQuantity>();
  let total = 0;
  for (const entry of entries) {
    const normalizedName = displayName(entry.name);
    if (!normalizedName || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
      throw new Error('Every card must have a name and a positive whole-number quantity.');
    }
    total += entry.quantity;
    if (!Number.isSafeInteger(total)) throw new Error('Deck quantity is too large.');
    const key = cardKey(normalizedName);
    const previous = cards.get(key);
    const quantity = (previous?.quantity ?? 0) + entry.quantity;
    if (!Number.isSafeInteger(quantity)) throw new Error('Card quantity is too large.');
    cards.set(key, { key, name: previous?.name ?? normalizedName, quantity });
  }
  return { name: displayName(name), cards: [...cards.values()] };
}

export function deckTotal(deck: DeckSnapshot): number {
  return deck.cards.reduce((sum, card) => sum + card.quantity, 0);
}
