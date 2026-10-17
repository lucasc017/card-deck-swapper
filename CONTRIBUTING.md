# Contributing

Thanks for helping make deck changes easier. Contributions to this project are under its [MIT license](LICENSE).

## Setup

Use Node.js 24 and npm. Run `npm ci` and `npm run dev`; no account, secret, or backend is required. For browser tests, run `npx playwright install chromium webkit` (add `--with-deps` on Linux).

## Keep the boundaries clear

- Domain functions stay pure: no DOM, network, browser storage, or UI strings.
- Import adapters validate unknown external data and return normalized snapshots. Fail the full import rather than silently dropping included cards.
- UI modules render state and dispatch actions. Use `textContent` for deck/card names, preserve focus, and label controls.
- State changes go through the reducer. Keep user data in memory and preserve the no-accounts/no-analytics design.
- Comparison remains directional, quantities matter, and only mainboard plus commanders count.

Use strict TypeScript and type-only imports where appropriate. Keep packages and assets local; avoid runtime dependencies for features native browser APIs can handle. Maintain light/dark styles and reduced-motion support.

## Before opening a pull request

```sh
npm test
npm run build
npm run test:e2e
```

Add focused tests when changing parsing, comparison, source switching, or progress behavior. Prefer synthetic fixtures without user data. Mock API-tab navigations, MTGJSON, and Scryfall in automated tests; a live request is not a reliable CI dependency. Verify the guided JSON handoff, local saved-file loading, truncated-response recovery, plain lists with blank lines before commanders, and mixed-source comparisons. Precon requests must remain on demand, exclude credentials and referrers, validate the full 100-card stock list, and offer explicit retry after failure. Alias checks must fetch the complete fixed public catalog before comparing, retain canonical identity separately from printed labels, and never send user deck data or silently use partial results. Cover flavor-name retitles, quantity aggregation, reversible and true multi-face cards, pagination, conflicts, and cancellation. File reads and obsolete provider responses must be ignored after relevant inputs change or the session resets. Check a narrow mobile viewport and desktop layout, keyboard operation, and both color schemes after UI changes.

Describe the problem, resulting behavior, and validation in the pull request. When reporting a bug, include the input format, browser, expected/actual behavior, and a small sanitized example. Do not include credentials or private deck exports.
