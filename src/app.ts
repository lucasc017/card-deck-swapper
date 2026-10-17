import { compareDecks } from './domain/compare';
import { ImportFailure } from './domain/types';
import type { DeckSide, DeckSnapshot } from './domain/types';
import { parseMoxfieldJson } from './imports/moxfield';
import { parseDeckText } from './imports/text';
import { createPreconProvider } from './imports/precons';
import { initialState, reduce } from './state';
import type { Action } from './state';
import { createDeckForm } from './ui/deck-form';
import type { DeckFormValues } from './ui/deck-form';
import { createRemovalList } from './ui/removal-list';
import { requiredElement } from './ui/status';

const exampleOriginal = 'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n1 Cultivate\n1 Kodama\'s Reach\n1 Lightning Greaves\n1 Swiftfoot Boots\n1 Swords to Plowshares\n1 Command Tower\n1 Exotic Orchard\n1 Path of Ancestry\n30 Forest\n20 Island\n20 Plains\n19 Swamp';
const exampleTarget = 'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n1 Lightning Greaves\n1 Swords to Plowshares\n1 Command Tower\n1 Exotic Orchard\n1 Path of Ancestry\n1 Nature\'s Lore\n1 Three Visits\n1 Heroic Intervention\n1 Farseek\n1 Beast Within\n1 Dovin\'s Veto\n27 Forest\n20 Island\n20 Plains\n19 Swamp';

export function mountApp() {
  let state = initialState();
  let sequence = 0;
  let comparedInputs: Readonly<Record<DeckSide, DeckFormValues>> | null = null;
  const notice = requiredElement('comparison-notice');
  const compareButton = requiredElement<HTMLButtonElement>('compare-button');
  const compareLabel = compareButton.querySelector('span');
  const swapButton = requiredElement<HTMLButtonElement>('swap-decks');
  const swapAnnouncement = requiredElement('swap-announcement');

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
  const precons = createPreconProvider();
  const forms = {
    original: createDeckForm('original', cancelPending, precons),
    target: createDeckForm('target', cancelPending, precons),
  };
  requiredElement('deck-inputs').append(forms.original.element, forms.target.element);
  const checklist = createRemovalList(dispatch);

  function render() {
    compareButton.disabled = state.loading;
    swapButton.disabled = state.loading || !state.comparison;
    compareButton.classList.toggle('is-loading', state.loading);
    compareButton.setAttribute('aria-busy', String(state.loading));
    if (compareLabel) compareLabel.textContent = state.loading ? 'Reading your decks…' : 'Find cards to remove';
    checklist.render(state);
  }

  async function compare(swapped = false) {
    cancelPending();
    const run = sequence;
    notice.hidden = true;
    swapAnnouncement.textContent = '';
    dispatch({ type: 'loading', value: true });
    const sides: readonly DeckSide[] = ['original', 'target'];
    const results = await Promise.allSettled(sides.map(async (side): Promise<DeckSnapshot> => {
      const form = forms[side];
      form.clearError(); form.loading(true);
      const source = form.read();
      const deck = source.kind === 'api'
        ? parseMoxfieldJson(source.value, source.url)
        : source.kind === 'precon' ? await form.precon()
        : parseDeckText(source.value, side === 'original' ? 'Original deck' : 'Target deck');
      if (run === sequence) form.ready(deck);
      return deck;
    }));
    if (run !== sequence) return;
    const [original, target] = results;
    if (original?.status === 'fulfilled' && target?.status === 'fulfilled') {
      comparedInputs = { original: forms.original.values(), target: forms.target.values() };
      dispatch({ type: 'compared', comparison: {
        original: original.value, target: target.value,
        items: compareDecks(original.value, target.value),
      } });
      if (swapped) {
        swapAnnouncement.textContent = `Decks swapped. Removing cards from ${original.value.name} to match ${target.value.name}. Removal progress reset.`;
        swapButton.focus({ preventScroll: true });
      } else {
        const heading = requiredElement('results-heading');
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
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
  swapButton.addEventListener('click', () => {
    if (!comparedInputs) return;
    const previous = comparedInputs;
    cancelPending();
    forms.original.restore(previous.target); forms.target.restore(previous.original);
    void compare(true);
  });
  requiredElement('example-button').addEventListener('click', () => {
    cancelPending();
    forms.original.setText(exampleOriginal); forms.target.setText(exampleTarget);
    void compare();
  });
  function startOver() {
    cancelPending();
    comparedInputs = null; swapAnnouncement.textContent = '';
    forms.original.reset(); forms.target.reset(); notice.hidden = true;
    dispatch({ type: 'start-over' }); forms.original.focus();
  }
  requiredElement('start-over').addEventListener('click', startOver);
  requiredElement('clear-session').addEventListener('click', startOver);
  render();
}
