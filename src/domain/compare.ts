import { normalizeDeck } from './normalize';
import type { DeckSnapshot, RemovalItem } from './types';

const alphabetical = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function compareDecks(original: DeckSnapshot, target: DeckSnapshot): readonly RemovalItem[] {
  const originalCards = normalizeDeck(original.name, original.cards).cards;
  const targetQuantities = new Map(
    normalizeDeck(target.name, target.cards).cards.map((card) => [card.key, card.quantity]),
  );
  return originalCards
    .map((card) => ({
      key: card.key,
      name: card.name,
      quantityToRemove: Math.max(card.quantity - (targetQuantities.get(card.key) ?? 0), 0),
    }))
    .filter((card) => card.quantityToRemove > 0)
    .sort((a, b) => alphabetical.compare(a.name, b.name));
}
