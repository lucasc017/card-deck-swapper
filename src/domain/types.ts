export type CardKey = string;

export interface CardQuantity {
  readonly key: CardKey;
  readonly name: string;
  readonly quantity: number;
  readonly printedNames?: readonly string[];
}

export interface DeckSnapshot {
  readonly name: string;
  readonly cards: readonly CardQuantity[];
}

export interface RemovalItem {
  readonly key: CardKey;
  readonly name: string;
  readonly quantityToRemove: number;
  readonly printedNames?: readonly string[];
}

export type RemovalProgress = ReadonlyMap<CardKey, number>;
export type DeckSide = 'original' | 'target';
export type ImportErrorCode =
  | 'invalid-url' | 'invalid-json' | 'unsupported-response' | 'invalid-text'
  | 'invalid-precon' | 'precon-unavailable' | 'invalid-aliases' | 'aliases-unavailable';

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
