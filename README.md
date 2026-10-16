# Deck Swapper

An open-source, session-only Commander workbench. Compare an original deck with a target deck, then check off exactly what to remove, in alphabetical order.

**[Open the app](https://lucasc017.github.io/card-deck-swapper/)** · [MIT license](LICENSE) · [Contributing](CONTRIBUTING.md)

## Use it

1. Enter the original and target Moxfield deck URLs, or select **Paste list** for either deck.
2. Select **Find cards to remove**. Check the imported deck names and card totals.
3. Work through the alphabetical checklist. Check individual cards or use the copy counter for repeated cards. Undo mistakes, filter remaining cards, or reset progress.

The comparison includes **mainboard and commanders combined**. Sideboards, considering lists, companions, and tokens are excluded. Artwork, set, collector number, and foil variations do not affect matching. Cards needed only by the target deck are outside this tool’s removal workflow. Deck legality is not evaluated; incomplete builds are allowed.

### Moxfield access and text fallback

URL import is best effort. It makes an anonymous browser request to `https://api2.moxfield.com/v3/decks/all/{id}`. Moxfield may block access through CORS or HTTP 403, limit requests, change its API, or restrict a deck’s visibility. A direct access check during development returned HTTP 403. The app uses no proxy, access token, or bypass. The isolated adapter validates supported v3 board data and legacy root-board data; fixtures do not guarantee future upstream compatibility.

If an import fails, choose **Use a pasted export instead**. Open Moxfield’s export menu and copy a text/Arena list. Include mainboard and commanders, using these headings when they are separate blocks:

```text
Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring (CMM) 396 *F*
8 Forest

Sideboard
1 This section is excluded
```

One unlabeled block is accepted. Multiple unlabeled blocks are rejected because the app cannot safely infer whether a block is a sideboard. Add `Commander`, `Deck`, and `Sideboard` headings, or paste only the included cards in one block. Both `1 Card Name` and `1x Card Name` work. Invalid included lines produce errors with line numbers; no partial comparison is created.

Use canonical English card names consistently in both lists, including complete split/double-faced names. Matching normalizes Unicode, whitespace, and capitalization; it does not resolve translated names, alternate-name aliases, or front-face-only names against full names. Printing suffixes and supported foil/commander markers are removed from text exports.

## Privacy

Deck inputs, imported cards, and progress exist only in page memory. Refreshing or starting over clears them. There are no accounts, application servers, cookies, localStorage, sessionStorage, IndexedDB, analytics, service workers, or remote fonts. Deck URLs are not written to the app’s address bar. Requests omit credentials and request no caching. The app never edits a deck on Moxfield.

URL import sends the deck ID to Moxfield. GitHub Pages serves the application. Those providers may maintain their ordinary infrastructure/security logs; the no-storage commitment covers data managed by this application. Static application files may be cached normally by the browser. **Keep the page open while removing cards.**

## Develop locally

Install Node.js 24 and npm, then:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, including `/card-deck-swapper/`. No environment variables or secrets are required. URL imports use the same cross-origin request in development and production.

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

On Linux, use `npx playwright install --with-deps chromium webkit`. Playwright starts the preview server automatically. Tests run in desktop Chromium and an iPhone-sized WebKit browser. Network imports are mocked for deterministic CI; live upstream access is a separate manual smoke check.

## Architecture

The application uses Vite, strict TypeScript, semantic HTML, and native DOM APIs. All packages are development tools; there are no production framework dependencies.

```text
src/domain/   Pure normalization and directional quantity comparison
src/imports/  Validated URL and text adapters producing DeckSnapshot
src/state.ts  Immutable reducer and derived removal totals
src/ui/       Forms, keyed checklist rows, accessible status messages
src/app.ts    Import orchestration, cancellation, and state updates
tests/        Unit tests, synthetic fixtures, and browser workflows
```

Data flows from deck input → validated snapshot → `max(original − target, 0)` per card → alphabetical removal items → in-memory progress. The UI preserves keyed rows and keyboard focus during updates. Failed imports leave the previous comparison intact and explicitly labeled. Successful new comparisons reset progress. A 15-second timeout and cancellation prevent old requests from replacing newer results.

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
