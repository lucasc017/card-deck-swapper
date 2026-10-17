# Deck Swapper

An open-source, session-only Commander workbench. Compare an original deck or stock precon with a target deck, then check off exactly what to remove, in alphabetical order.

**[Open the app](https://lucasc017.github.io/card-deck-swapper/)** · [MIT license](LICENSE) · [Contributing](CONTRIBUTING.md)

## Use it

1. Upgrading a precon? Select **Choose precon** in **Original deck**, search by deck name or set code, and select the stock list. It loads automatically; you only need to import your upgraded list in **Target deck**.
2. For a custom deck, use **Guided API**: enter its Moxfield link, select **Open API response**, then copy the complete JSON back into the app or choose a saved JSON file. Both normal deck links and `api2.moxfield.com/v3/decks/all/…` links work.
3. If the API tab is blocked or unavailable, select **Paste deck** and paste a counted card list instead. You can mix source types.
4. Select **Find cards to remove**. Check the imported deck names and card totals.
5. Work through the alphabetical checklist. Check individual cards or use the copy counter for repeated cards. Undo mistakes, filter remaining cards, or reset progress.

Entered the decks in reverse? Select **Swap decks** below the comparison’s deck summary. The app exchanges the inputs (including their source modes, precon selections, URLs, and JSON/text), recalculates removals in the opposite direction, and resets removal progress and filtering. You can swap back with the same button. If a later edit fails to import, swapping uses the last successfully compared deck pair shown in the checklist. A previously loaded precon remains available for swapping without another provider request.

The comparison includes **mainboard and commanders combined**. Sideboards, considering lists, companions, and tokens are excluded. Artwork, set, collector number, and foil variations do not affect matching. Cards needed only by the target deck are outside this tool’s removal workflow. Deck legality is not evaluated; incomplete builds are allowed.

### Stock Commander precons

**Choose precon** is available in either panel, so you can upgrade from a stock list or reverse the comparison to restore one. The catalog comes live from [MTGJSON](https://mtgjson.com/downloads/all-decks/) and includes its physical **Commander Deck** entries, including starter Commander decks, crossover products, and separately named editions. Search by deck name or set code; options show the set code and release year, newest releases first. Searching never selects a deck for you.

The app requests the catalog only when you choose this source, then downloads only the selected deck. It shows the deck name, commanders, and card total. Stock imports must contain exactly 100 mainboard and commander cards; display commanders, planes, schemes, sideboards, and tokens are excluded. Your upgraded list can still be an incomplete build. Matching uses full canonical English names, as with other imports.

MTGJSON availability and coverage determine which precons can be selected. Requests time out after 15 seconds and offer **Retry**, without automatic retry loops. If a deck is unavailable or its data is incomplete, choose **Paste deck** and provide the stock list manually. Failures leave the previous checklist and its progress intact. Successful public catalog/deck responses stay in page memory; reloading starts a new session and loads the catalog again when needed. No bundled fallback catalog is included.

### Alternate card titles

Official English flavor-name retitles are matched as the same card across every import source. For example, **Marauding Mutagen** from Turtle Power! matches **Acidic Slime** whether it appears in a selected precon, pasted list, guided JSON response, or saved file. Changing only the title produces no removal, including after swapping decks. Quantities under alternate and canonical names are combined before comparison.

On the first valid comparison in a page session, the app loads Scryfall’s complete public English paper-card flavor-name catalog. It requests every page of the fixed `is:flavorname lang:en game:paper` search, including printing variations, without searching for any cards from your lists. Requests run sequentially, at least 150 ms apart, with a 15-second timeout per request. Successful data stays in page memory for later comparisons and swaps. Reloading starts a new catalog lookup on the next valid comparison.

The comparison waits for the complete catalog. A failed or incomplete lookup offers **Retry** and preserves the previous checklist and progress; the app does not fall back to potentially incorrect name-only matching. Conflicting identities affecting an entered card also prevent a new comparison. Selected precon metadata supplements the public catalog without changing the shared session cache.

When a renamed card really needs removing, the checklist shows its original-side printed title and canonical name, such as **Marauding Mutagen (Acidic Slime)**. A group containing several printed titles retains them in one row. Canonical-only inputs keep their canonical label; titles are not borrowed from the target deck. Rows sort by their displayed label. True split/transform cards retain their whole-card identity; reversible treatments of a single card share that card’s identity.

### Guided API and text fallback

The app constructs a fixed `https://api2.moxfield.com/v3/decks/all/{id}` link and opens it in a separate tab when you select **Open API response**. Copy the complete JSON response and paste it into the labeled field. In a browser JSON viewer, use its **Copy** function, or open the raw response and select all. Selecting only the visible or expanded cards can leave out the rest of the response. You can also paste JSON you already have without entering a link.

For large responses, use the API viewer’s **Save** option (or the browser’s Save Page command) to save the raw response as a `.json` file. In the app, use **Or choose a saved JSON file**. The app reads and validates the file locally, displays the deck name and total, and fills the JSON field for comparison. It does not upload the file. An incomplete response cannot safely produce a removal list; copy or save the entire response again, or use the text fallback.

The app does not fetch Moxfield in the background or try to read the other tab. The manual handoff avoids cross-origin JavaScript restrictions. Moxfield can still block the API tab, return an error, or change its response format. If that happens, select **Paste deck**, open Moxfield’s export menu, and copy a text/Arena list. No proxy, Worker, access token, or account is required by this app.

Paste mainboard cards and commanders together. The mainboard followed by a blank line and one or more commanders is accepted directly:

```text
1 Sol Ring
4 Forest
2 Island

1 Leonardo, the Balance
1 Michelangelo, the Heart
```

Blank lines are ignored. All unlabeled card lines are included, so leave sideboards and other extra boards out. Explicit `Deck`, `Mainboard`, and `Commander` headings are also supported; label any excluded cards:

```text
Deck
1 Sol Ring (CMM) 396 *F*
4 Forest

Commander
1 Your Commander

Sideboard
1 This section is excluded
```

Both `1 Card Name` and `1x Card Name` work. Invalid included lines produce errors with line numbers; no partial comparison is created. Invalid or incomplete JSON likewise produces an error with saved-file and text-paste recovery guidance. When a JSON response includes its public deck ID, it must match the entered link. Editing a link clears its old pasted JSON so it cannot accidentally be reused for another deck. Editing inputs, switching sources, or starting over cancels any unfinished local file read.

Use English card names, including complete split/double-faced names. Matching normalizes Unicode, whitespace, and capitalization and resolves official flavor-name aliases. It does not infer translated names, spelling corrections, mechanically similar cards, or isolated front-face names against whole split/transform cards. Printing suffixes and supported foil/commander markers are removed from text exports.

## Privacy

Deck inputs, imported cards, and progress exist only in page memory. Refreshing or starting over clears your inputs, precon selections, and progress. Public precon and alias data may remain in memory until the page is reloaded. The app creates no accounts, application servers, cookies, localStorage, sessionStorage, IndexedDB, analytics, service workers, or remote fonts. Deck URLs are not written to the app’s address bar. The app never edits a deck on Moxfield and does not request clipboard access. A JSON file you choose is read on your device and is never uploaded; any file you save from Moxfield remains on your device until you delete it.

Choosing a precon contacts `mtgjson.com` for the public catalog and selected deck file, without credentials or a referrer. MTGJSON can see your IP address and requested public deck, but receives none of your pasted or saved deck data, Moxfield links, or removal progress. Ordinary browser HTTP caching can apply; the first request in a page session asks the provider to revalidate cached content. Comparisons and checklist updates run locally.

The first valid comparison also contacts `api.scryfall.com` for a fixed public alternate-name catalog, without credentials or a referrer. Scryfall can see your IP address and the public search, but receives no user deck contents, URLs, files, or progress. No per-card requests are made. Custom-list comparisons therefore require Scryfall to be reachable for the first successful catalog load in each page session.

Opening the guided API link visits Moxfield directly in another tab, without sending a referrer or giving that tab access to this app. Moxfield may use its own cookies or browser session, and the API URL may appear in your browser history. GitHub Pages serves the application. Those providers may maintain their ordinary infrastructure/security logs; the no-storage commitment covers data managed by this application. Static application files may be cached normally by the browser. **Keep the app page open while removing cards.**

## Develop locally

Install Node.js 24 and npm, then:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, including `/card-deck-swapper/`. No environment variables or secrets are required. The same guided API, paste, and live precon flows work in development and production.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development with Vite |
| `npm run typecheck` | Strict TypeScript checking |
| `npm test` | Unit tests with Vitest |
| `npm run test:watch` | Watch unit tests |
| `npm run build` | Type-check and build static output into `dist/` |
| `npm run preview` | Serve the built application locally |
| `npm run test:e2e` | Browser acceptance tests against the built application |

Before the first browser test:

```sh
npx playwright install chromium webkit
npm run build
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium webkit`. Playwright starts the preview server automatically. Tests run in desktop Chromium and an iPhone-sized WebKit browser. API-tab navigations, MTGJSON requests, and Scryfall requests are mocked for deterministic CI; routine checks do not depend on provider availability.

## Architecture

The application uses Vite, strict TypeScript, semantic HTML, and native DOM APIs. All packages are development tools; there are no production framework dependencies.

```text
src/domain/   Pure normalization and directional quantity comparison
src/imports/  Validated URL and text adapters producing DeckSnapshot
src/state.ts  Immutable reducer and derived removal totals
src/ui/       Forms, keyed checklist rows, accessible status messages
src/app.ts    Import coordination and state updates
tests/        Unit tests, synthetic fixtures, and browser workflows
```

Data flows from pasted API JSON, deck text, or an on-demand MTGJSON precon → validated snapshot → complete public alias registry plus selected precon metadata → canonical identity and quantity aggregation → `max(original − target, 0)` per card → removal items with original printed titles → in-memory progress. The UI preserves keyed rows and keyboard focus during updates. Failed imports or alias checks leave the previous comparison intact and explicitly labeled. Successful new comparisons reset progress. Parsing and comparison run locally; only public precon data and the fixed alias catalog are fetched. Moxfield remains a manual handoff, and no source has automatic retry loops.

## GitHub Pages and forks

The public repository is `lucasc017/card-deck-swapper`, with `main` as its default branch. GitHub Actions validates pull requests and pushes to `main`: unit tests, TypeScript checking, production build, and browser tests. After successful checks on `main`, a separate job publishes the tested `dist/` artifact to the `github-pages` environment.

To deploy your fork:

1. Set `base` in `vite.config.ts` to `/<your-repository-name>/` (or `/` for a user site/custom-domain root).
2. Update the repository and homepage metadata, source links, and README app link.
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
4. Push to `main` or run the workflow manually from `main`.

The workflow uses GitHub’s built-in token; no personal token is needed in repository secrets. Pull request jobs have read-only repository permissions. Pages write and OIDC permissions belong only to the deployment job. Build output and test artifacts are not committed.

## License and attribution

Application source is available under the [MIT license](LICENSE). Contributions are welcome under the same license. Public precon data is provided by [MTGJSON](https://mtgjson.com/) under its [MIT license](https://mtgjson.com/license/). Alternate-name data is provided by [Scryfall](https://scryfall.com/). This independent fan tool is not affiliated with MTGJSON, Scryfall, Moxfield, or Wizards of the Coast. Magic: The Gathering and card names belong to their respective owners; the software license does not grant rights to third-party trademarks or card content.
