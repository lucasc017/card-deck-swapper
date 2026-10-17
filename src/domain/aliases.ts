import { cardKey, displayName, normalizeDeck } from './normalize';
import type { DeckSnapshot } from './types';

export interface CardIdentity {
  readonly name: string;
  readonly oracleId?: string;
}

export interface CardAlias extends CardIdentity {
  readonly alias: string;
}

export type AliasRegistry = ReadonlyMap<string, readonly CardIdentity[]>;

export class AliasConflict extends Error {
  constructor(public readonly cardName: string) {
    super(`Ambiguous card name: ${cardName}`);
    this.name = 'AliasConflict';
  }
}

export function createAliasRegistry(aliases: readonly CardAlias[], base: AliasRegistry = new Map()): AliasRegistry {
  const registry = new Map([...base].map(([key, identities]) => [key, [...identities]]));
  for (const entry of aliases) {
    const identity: CardIdentity = { name: displayName(entry.name), ...(entry.oracleId ? { oracleId: entry.oracleId } : {}) };
    if (!identity.name || !displayName(entry.alias)) throw new Error('Alias names must not be empty.');
    for (const title of [entry.alias, identity.name]) {
      const key = cardKey(title);
      const candidates = registry.get(key) ?? [];
      const existing = candidates.findIndex((candidate) => cardKey(candidate.name) === cardKey(identity.name)
        && (!candidate.oracleId || !identity.oracleId || candidate.oracleId === identity.oracleId));
      if (existing === -1) candidates.push(identity);
      else if (!candidates[existing]?.oracleId && identity.oracleId) candidates[existing] = identity;
      registry.set(key, candidates);
    }
  }
  return registry;
}

export function includeDeckAliases(registry: AliasRegistry, decks: readonly DeckSnapshot[]): AliasRegistry {
  return createAliasRegistry(decks.flatMap((deck) => deck.cards.flatMap((card) =>
    (card.printedNames ?? []).map((alias) => ({ alias, name: card.name })))), registry);
}

export function resolveDeckAliases(deck: DeckSnapshot, registry: AliasRegistry): DeckSnapshot {
  const resolve = (name: string): CardIdentity => {
    const candidates = registry.get(cardKey(name));
    if (candidates && candidates.length !== 1) throw new AliasConflict(name);
    return candidates?.[0] ?? { name };
  };
  return normalizeDeck(deck.name, deck.cards.map((card) => {
    const identity = resolve(card.name);
    const printedNames = card.printedNames ?? [card.name];
    for (const title of printedNames) {
      if (cardKey(resolve(title).name) !== cardKey(identity.name)) throw new AliasConflict(title);
    }
    return { name: identity.name, quantity: card.quantity, printedNames };
  }));
}
