import type { DeckSnapshot, RemovalItem, RemovalProgress } from './domain/types';

export interface Comparison {
  readonly original: DeckSnapshot;
  readonly target: DeckSnapshot;
  readonly items: readonly RemovalItem[];
}

export interface AppState {
  readonly comparison: Comparison | null;
  readonly progress: RemovalProgress;
  readonly remainingOnly: boolean;
  readonly loading: boolean;
}

export type Action =
  | { readonly type: 'loading'; readonly value: boolean }
  | { readonly type: 'compared'; readonly comparison: Comparison }
  | { readonly type: 'adjust'; readonly key: string; readonly delta: number }
  | { readonly type: 'remaining-only'; readonly value: boolean }
  | { readonly type: 'reset-progress' }
  | { readonly type: 'start-over' };

export function initialState(): AppState {
  return { comparison: null, progress: new Map(), remainingOnly: false, loading: false };
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loading': return { ...state, loading: action.value };
    case 'compared': return { comparison: action.comparison, progress: new Map(), remainingOnly: false, loading: false };
    case 'remaining-only': return { ...state, remainingOnly: action.value };
    case 'reset-progress': return { ...state, progress: new Map() };
    case 'start-over': return initialState();
    case 'adjust': {
      const item = state.comparison?.items.find((entry) => entry.key === action.key);
      if (!item || !Number.isSafeInteger(action.delta)) return state;
      const progress = new Map(state.progress);
      progress.set(action.key, Math.max(0, Math.min(item.quantityToRemove, (progress.get(action.key) ?? 0) + action.delta)));
      return { ...state, progress };
    }
  }
}

export function totals(state: AppState): { required: number; removed: number; remaining: number } {
  const required = state.comparison?.items.reduce((sum, card) => sum + card.quantityToRemove, 0) ?? 0;
  const removed = state.comparison?.items.reduce((sum, card) => sum + (state.progress.get(card.key) ?? 0), 0) ?? 0;
  return { required, removed, remaining: required - removed };
}
