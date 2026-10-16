import { normalizeDeck } from '../domain/normalize';
import { ImportFailure } from '../domain/types';
import type { DeckSnapshot, LineIssue } from '../domain/types';

const included = new Set(['commander', 'commanders', 'mainboard', 'maindeck', 'deck']);
const excluded = new Set([
  'sideboard', 'considering', 'maybeboard', 'tokens', 'companion', 'companions',
  'attractions', 'stickers', 'signature spells',
]);

function sectionName(line: string): string {
  return line.replace(/^(?:\/\/|#)\s*/u, '').replace(/^\[/u, '')
    .replace(/\]?:?$/u, '').trim().toLocaleLowerCase('en-US');
}

function stripMetadata(name: string): string {
  return name
    .replace(/(?:\s+\*(?:F|E|CMDR|COMMANDER)\*)+\s*$/iu, '')
    .replace(/\s+\([a-z0-9]{2,8}\)(?:\s+[a-z0-9★☆†/.*-]+)?\s*$/iu, '')
    .trim();
}

export function parseDeckText(text: string, name = 'Pasted deck'): DeckSnapshot {
  const entries: { name: string; quantity: number }[] = [];
  const issues: LineIssue[] = [];
  let section: 'implicit' | 'included' | 'excluded' = 'implicit';
  let implicitCards = false;
  let gap = false;

  text.replace(/^\uFEFF/u, '').split(/\r?\n/u).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      if (section === 'implicit' && implicitCards) gap = true;
      return;
    }
    const heading = sectionName(line);
    if (included.has(heading) || excluded.has(heading)) {
      section = included.has(heading) ? 'included' : 'excluded';
      gap = false;
      return;
    }
    if (/^(?:\/\/|#)/u.test(line)) return;
    if (section === 'excluded') {
      if (/^[\p{L}][\p{L}\s]*:?$/u.test(line)) {
        issues.push({ line: index + 1, message: 'Unknown section. Use Deck, Commander, or Sideboard headings.' });
      }
      return;
    }
    if (section === 'implicit' && gap) {
      issues.push({ line: index + 1, message: 'Multiple unlabeled blocks. Add Deck / Commander / Sideboard headings, or paste one block containing only mainboard and commanders.' });
      gap = false;
    }
    const match = /^(\d+)[xX]?\s+(.+)$/u.exec(line);
    if (!match?.[1] || !match[2]) {
      issues.push({ line: index + 1, message: 'Expected a quantity and card name, for example: 1 Sol Ring.' });
      return;
    }
    const quantity = Number(match[1]);
    const cardName = stripMetadata(match[2]);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !cardName) {
      issues.push({ line: index + 1, message: 'Use a positive whole-number quantity and a card name.' });
      return;
    }
    if (section === 'implicit') implicitCards = true;
    entries.push({ name: cardName, quantity });
  });

  if (issues.length) throw new ImportFailure('invalid-text', 'The list needs a small fix before comparing.', issues);
  if (!entries.length) throw new ImportFailure('invalid-text', 'Paste at least one mainboard or commander card, including its quantity.');
  try {
    return normalizeDeck(name, entries);
  } catch {
    throw new ImportFailure('invalid-text', 'The combined card quantities are too large. Check your list.');
  }
}
