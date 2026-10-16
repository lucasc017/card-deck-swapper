export type CardKey = string;

export interface CardQuantity {
  readonly key: CardKey;
  readonly name: string;
  readonly quantity: number;
}

export interface DeckSnapshot {
  readonly name: string;
  readonly cards: readonly CardQuantity[];
}

export interface RemovalItem {
  readonly key: CardKey;
  readonly name: string;
  readonly quantityToRemove: number;
}

export type RemovalProgress = ReadonlyMap<CardKey, number>;
export type DeckSide = 'original' | 'target';
export type ImportErrorCode =
  | 'invalid-url' | 'unavailable' | 'network' | 'timeout'
  | 'unsupported-response' | 'invalid-text' | 'aborted';

export interface LineIssue {
  readonly line: number;
  readonly message: string;
}

export class ImportFailure extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
    public readonly issues: readonly LineIssue[] = [],
  ) {
    super(message);
    this.name = 'ImportFailure';
  }
}
