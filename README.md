# Deck Swapper

An open-source, session-only Commander workbench. Compare an original deck with a target deck, then check off exactly what to remove, in alphabetical order.

**[Open the app](https://lucasc017.github.io/card-deck-swapper/)** · [MIT license](LICENSE) · [Contributing](CONTRIBUTING.md)

## Use it

1. For each deck, use **Guided API**: enter its Moxfield link, select **Open API response**, then copy the complete JSON back into the app or choose a saved JSON file. Both normal deck links and `api2.moxfield.com/v3/decks/all/…` links work.
2. If the API tab is blocked or unavailable, select **Paste deck** and paste a counted card list instead. You can use JSON for one deck and text for the other.
3. Select **Find cards to remove**. Check the imported deck names and card totals.
4. Work through the alphabetical checklist. Check individual cards or use the copy counter for repeated cards. Undo mistakes, filter remaining cards, or reset progress.

The comparison includes **mainboard and commanders combined**. Sideboards, considering lists, companions, and tokens are excluded. Artwork, set, collector number, and foil variations do not affect matching. Cards needed only by the target deck are outside this tool’s removal workflow. Deck legality is not evaluated; incomplete builds are allowed.

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

Use canonical English card names consistently in both lists, including complete split/double-faced names. Matching normalizes Unicode, whitespace, and capitalization; it does not resolve translated names, alternate-name aliases, or front-face-only names against full names. Printing suffixes and supported foil/commander markers are removed from text exports.

## Privacy

Deck inputs, imported cards, and progress exist only in page memory. Refreshing or starting over clears them. The app creates no accounts, application servers, cookies, localStorage, sessionStorage, IndexedDB, analytics, service workers, or remote fonts. Deck URLs are not written to the app’s address bar. The app never edits a deck on Moxfield and does not request clipboard access. A JSON file you choose is read on your device and is never uploaded; any file you save from Moxfield remains on your device until you delete it.

Opening the guided API link visits Moxfield directly in another tab, without sending a referrer or giving that tab access to this app. Moxfield may use its own cookies or browser session, and the API URL may appear in your browser history. GitHub Pages serves the application. Those providers may maintain their ordinary infrastructure/security logs; the no-storage commitment covers data managed by this application. Static application files may be cached normally by the browser. **Keep the app page open while removing cards.**

## Develop locally

Install Node.js 24 and npm, then:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, including `/card-deck-swapper/`. No environment variables or secrets are required. The same guided API and paste flows work in development and production.

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

On Linux, use `npx playwright install --with-deps chromium webkit`. Playwright starts the preview server automatically. Tests run in desktop Chromium and an iPhone-sized WebKit browser. API-tab navigations are mocked for deterministic CI; routine checks do not depend on Moxfield availability.

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

Data flows from pasted API JSON or deck text → validated snapshot → `max(original − target, 0)` per card → alphabetical removal items → in-memory progress. The UI preserves keyed rows and keyboard focus during updates. Failed imports leave the previous comparison intact and explicitly labeled. Successful new comparisons reset progress. All parsing and comparison run locally; there are no background deck requests or retry loops.

## GitHub Pages and forks

The public repository is `lucasc017/card-deck-swapper`, with `main` as its default branch. GitHub Actions validates pull requests and pushes to `main`: unit tests, TypeScript checking, production build, and browser tests. After successful checks on `main`, a separate job publishes the tested `dist/` artifact to the `github-pages` environment.

To deploy your fork:

1. Set `base` in `vite.config.ts` to `/<your-repository-name>/` (or `/` for a user site/custom-domain root).
2. Update the repository and homepage metadata, source links, and README app link.
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
4. Push to `main` or run the workflow manually from `main`.

The workflow uses GitHub’s built-in token; no personal token is needed in repository secrets. Pull request jobs have read-only repository permissions. Pages write and OIDC permissions belong only to the deployment job. Build output and test artifacts are not committed.

## License and attribution

Application source is available under the [MIT license](LICENSE). Contributions are welcome under the same license. This independent fan tool is not affiliated with Moxfield or Wizards of the Coast. Magic: The Gathering and card names belong to their respective owners; the software license does not grant rights to third-party trademarks or card content.
