import { includeDeckAliases, resolveDeckAliases } from './aliases';
import type { AliasRegistry } from './aliases';
import { cardLabel } from './normalize';
import type { DeckSnapshot, RemovalItem } from './types';

const alphabetical = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function compareDecks(original: DeckSnapshot, target: DeckSnapshot, aliases: AliasRegistry = new Map()): readonly RemovalItem[] {
  const registry = includeDeckAliases(aliases, [original, target]);
  const originalCards = resolveDeckAliases(original, registry).cards;
  const targetQuantities = new Map(
    resolveDeckAliases(target, registry).cards.map((card) => [card.key, card.quantity]),
  );
  return originalCards
    .map((card) => ({
      key: card.key,
      name: card.name,
      ...(card.printedNames ? { printedNames: card.printedNames } : {}),
      quantityToRemove: Math.max(card.quantity - (targetQuantities.get(card.key) ?? 0), 0),
    }))
    .filter((card) => card.quantityToRemove > 0)
    .sort((a, b) => alphabetical.compare(cardLabel(a), cardLabel(b)));
}
