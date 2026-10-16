import { describe, expect, it } from 'vitest';
import { compareDecks } from '../../src/domain/compare';
import { parseDeckText } from '../../src/imports/text';
import { initialState, reduce, totals } from '../../src/state';

const original = parseDeckText('5 Forest\n1 Sol Ring');
const target = parseDeckText('2 Forest');
const comparison = { original, target, items: compareDecks(original, target) };
const compared = () => reduce(initialState(), { type: 'compared', comparison });

describe('checklist state', () => {
  it('tracks individual copies, supports undo, and leaves the previous state unchanged', () => {
    const before = compared();
    const after = reduce(before, { type: 'adjust', key: 'forest', delta: 1 });
    expect(before.progress.size).toBe(0);
    expect(totals(after)).toEqual({ required: 4, removed: 1, remaining: 3 });
    expect(reduce(after, { type: 'adjust', key: 'forest', delta: -1 }).progress.get('forest')).toBe(0);
  });
  it('clamps progress to the required quantity and zero', () => {
    const high = reduce(compared(), { type: 'adjust', key: 'forest', delta: 99 });
    expect(high.progress.get('forest')).toBe(3);
    expect(reduce(high, { type: 'adjust', key: 'forest', delta: -99 }).progress.get('forest')).toBe(0);
  });
  it('ignores unknown card keys and fractional adjustments', () => {
    const state = compared();
    expect(reduce(state, { type: 'adjust', key: 'unknown', delta: 1 })).toBe(state);
    expect(reduce(state, { type: 'adjust', key: 'forest', delta: NaN })).toBe(state);
  });
  it('resets progress without changing the comparison', () => {
    const changed = reduce(compared(), { type: 'adjust', key: 'forest', delta: 2 });
    const reset = reduce(changed, { type: 'reset-progress' });
    expect(reset.comparison).toBe(comparison);
    expect(totals(reset).removed).toBe(0);
  });
  it('resets progress and filtering for a successful new comparison', () => {
    const changed = reduce(reduce(compared(), { type: 'adjust', key: 'forest', delta: 2 }), { type: 'remaining-only', value: true });
    const next = reduce(changed, { type: 'compared', comparison });
    expect(next.progress.size).toBe(0);
    expect(next.remainingOnly).toBe(false);
  });
  it('preserves the previous checklist while loading or after import failure', () => {
    const state = reduce(compared(), { type: 'adjust', key: 'forest', delta: 1 });
    const done = reduce(reduce(state, { type: 'loading', value: true }), { type: 'loading', value: false });
    expect(done.comparison).toBe(state.comparison);
    expect(done.progress.get('forest')).toBe(1);
    expect(reduce(done, { type: 'start-over' })).toEqual(initialState());
  });
});
