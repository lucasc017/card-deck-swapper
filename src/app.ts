import { compareDecks } from './domain/compare';
import { ImportFailure } from './domain/types';
import type { DeckSide, DeckSnapshot } from './domain/types';
import { parseMoxfieldJson } from './imports/moxfield';
import { parseDeckText } from './imports/text';
import { initialState, reduce } from './state';
import type { Action } from './state';
import { createDeckForm } from './ui/deck-form';
import { createRemovalList } from './ui/removal-list';
import { requiredElement } from './ui/status';

const exampleOriginal = 'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n1 Cultivate\n1 Kodama\'s Reach\n1 Lightning Greaves\n1 Swiftfoot Boots\n1 Swords to Plowshares\n1 Command Tower\n1 Exotic Orchard\n1 Path of Ancestry\n30 Forest\n20 Island\n20 Plains\n19 Swamp';
const exampleTarget = 'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n1 Lightning Greaves\n1 Swords to Plowshares\n1 Command Tower\n1 Exotic Orchard\n1 Path of Ancestry\n1 Nature\'s Lore\n1 Three Visits\n1 Heroic Intervention\n1 Farseek\n1 Beast Within\n1 Dovin\'s Veto\n27 Forest\n20 Island\n20 Plains\n19 Swamp';

export function mountApp() {
  let state = initialState();
  let sequence = 0;
  const notice = requiredElement('comparison-notice');
  const compareButton = requiredElement<HTMLButtonElement>('compare-button');
  const compareLabel = compareButton.querySelector('span');

  function dispatch(action: Action) {
    state = reduce(state, action);
    render();
  }
  function cancelPending() {
    sequence += 1;
    if (state.loading) {
      forms.original.loading(false); forms.target.loading(false);
      dispatch({ type: 'loading', value: false });
    }
  }
  const forms = {
    original: createDeckForm('original', cancelPending),
    target: createDeckForm('target', cancelPending),
  };
  requiredElement('deck-inputs').append(forms.original.element, forms.target.element);
  const checklist = createRemovalList(dispatch);

  function render() {
    compareButton.disabled = state.loading;
    compareButton.classList.toggle('is-loading', state.loading);
    compareButton.setAttribute('aria-busy', String(state.loading));
    if (compareLabel) compareLabel.textContent = state.loading ? 'Reading your decks…' : 'Find cards to remove';
    checklist.render(state);
  }

  async function compare() {
    cancelPending();
    const run = sequence;
    notice.hidden = true;
    dispatch({ type: 'loading', value: true });
    const sides: readonly DeckSide[] = ['original', 'target'];
    const results = await Promise.allSettled(sides.map(async (side): Promise<DeckSnapshot> => {
      const form = forms[side];
      form.clearError(); form.loading(true);
      const source = form.read();
      const deck = source.kind === 'api'
        ? parseMoxfieldJson(source.value, source.url)
        : parseDeckText(source.value, side === 'original' ? 'Original deck' : 'Target deck');
      if (run === sequence) form.ready(deck);
      return deck;
    }));
    if (run !== sequence) return;
    const [original, target] = results;
    if (original?.status === 'fulfilled' && target?.status === 'fulfilled') {
      dispatch({ type: 'compared', comparison: {
        original: original.value, target: target.value,
        items: compareDecks(original.value, target.value),
      } });
      const heading = requiredElement('results-heading');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    } else {
      results.forEach((result, index) => {
        const side = sides[index];
        if (side && result.status === 'rejected') {
          const error: unknown = result.reason;
          forms[side].showError(error instanceof ImportFailure ? error : new ImportFailure('unsupported-response', 'This deck could not be read safely. Please check the input.'));
        }
      });
      dispatch({ type: 'loading', value: false });
      notice.textContent = state.comparison
        ? 'Couldn’t compare these lists. Your previous checklist below is unchanged and still refers to the deck names shown there.'
        : 'Check the deck inputs above, then try again. Nothing has been compared yet.';
      notice.hidden = false; notice.focus();
    }
  }

  requiredElement<HTMLFormElement>('compare-form').addEventListener('submit', (event) => { event.preventDefault(); void compare(); });
  requiredElement('example-button').addEventListener('click', () => {
    cancelPending();
    forms.original.setText(exampleOriginal); forms.target.setText(exampleTarget);
    void compare();
  });
  function startOver() {
    cancelPending();
    forms.original.reset(); forms.target.reset(); notice.hidden = true;
    dispatch({ type: 'start-over' }); forms.original.focus();
  }
  requiredElement('start-over').addEventListener('click', startOver);
  requiredElement('clear-session').addEventListener('click', startOver);
  render();
}
