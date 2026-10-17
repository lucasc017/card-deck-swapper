import { test, expect } from './fixtures';
import type { Page, Route } from '@playwright/test';
import { ALIAS_QUERY, ALIAS_URL } from '../../src/imports/aliases';
import { aliasPayload, slimeAliasCard, turtleAliasText, turtleCatalog, turtlePayload } from '../fixtures/aliases';
import { moxfieldFixture } from '../fixtures/decks';

const aliasRoute = 'https://api.scryfall.com/cards/search**';
const pageTwo = `${ALIAS_URL}&page=2`;
const firstPage = { ...aliasPayload, total_cards: 3, has_more: true, next_page: pageTwo, data: [slimeAliasCard] };
const secondPage = { ...aliasPayload, data: aliasPayload.data.slice(1) };
const cors = { 'access-control-allow-origin': '*' };

async function paste(page: Page, side: 'original' | 'target', value: string) {
  await page.locator(`.deck-card-${side}`).getByRole('button', { name: 'Paste deck', exact: true }).click();
  await page.locator(`#${side}-text`).fill(value);
}

async function compare(page: Page) {
  await page.locator('#compare-button').click();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
});

test('loads all public alias pages on the first valid comparison and reuses them for edits and swaps', async ({ page }) => {
  const requests: string[] = [];
  await page.route(aliasRoute, (route) => {
    const request = route.request();
    expect(request.method()).toBe('GET'); expect(request.postData()).toBeNull();
    expect(request.headers()['referer']).toBeUndefined();
    expect(new URL(request.url()).searchParams.get('q')).toBe(ALIAS_QUERY);
    requests.push(request.url());
    return route.fulfill({ json: requests.length === 1 ? firstPage : secondPage, headers: cors });
  });
  await page.goto('./'); expect(requests).toEqual([]);
  await paste(page, 'original', '1 Marauding Mutagen');
  await paste(page, 'target', 'bad input'); await compare(page);
  await expect(page.locator('#target-error')).toBeVisible(); expect(requests).toEqual([]);
  await page.locator('#target-text').fill('1 Acidic Slime'); await compare(page);
  await expect(page.locator('#completion-message')).toContainText('No removals needed');
  expect(requests).toHaveLength(2);
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await expect(page.locator('#completion-message')).toContainText('No removals needed');
  await page.locator('#target-text').fill('1 Forest'); await compare(page);
  await expect(page.locator('.card-name')).toHaveText(['Acidic Slime']);
  expect(requests).toHaveLength(2);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test('matches Turtle Power titles in either direction and labels real removals with both names', async ({ page }, info) => {
  await page.route('https://mtgjson.com/api/v5/**', (route) => route.fulfill({
    json: route.request().url().endsWith('DeckList.json') ? turtleCatalog : turtlePayload, headers: cors,
  }));
  await page.goto('./');
  await page.locator('.deck-card-original').getByRole('button', { name: 'Choose precon', exact: true }).click();
  await page.locator('#original-precon').selectOption('TurtlePower_TMC');
  await expect(page.locator('#original-precon-preview')).toContainText('100 cards');
  await paste(page, 'target', turtleAliasText); await compare(page);
  await expect(page.locator('#completion-message')).toContainText('No removals needed');
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await expect(page.locator('#completion-message')).toContainText('No removals needed');
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await page.locator('#target-text').fill(turtleAliasText.replace('1 Marauding Mutagen\n', '')); await compare(page);
  await expect(page.locator('.card-name')).toHaveText(['Marauding Mutagen (Acidic Slime)']);
  await expect(page.locator('#original-total')).toHaveText('100 cards · mainboard + commanders');
  const checkbox = page.getByRole('checkbox', { name: 'Mark Marauding Mutagen (Acidic Slime) removed', exact: true });
  await checkbox.focus(); await page.keyboard.press('Space');
  await expect(page.locator('#removed-count')).toHaveText('1'); await expect(checkbox).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('aliases-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('aliases-dark.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('resolves aliases in guided and saved JSON and combines mixed-title copy counts', async ({ page }) => {
  await page.goto('./');
  const json = JSON.stringify(moxfieldFixture('My renamed cards', [['Marauding Mutagen', 2], ['Acidic Slime', 1]], []));
  await page.locator('#original-json').fill(json);
  await paste(page, 'target', '1 Acidic Slime'); await compare(page);
  await expect(page.locator('.card-name')).toHaveText(['Marauding Mutagen (Acidic Slime)']);
  await expect(page.locator('#remaining-count')).toHaveText('2 left to pull');
  await page.getByRole('button', { name: 'Mark one Marauding Mutagen (Acidic Slime) removed', exact: true }).click();
  await expect(page.locator('#removed-count')).toHaveText('1');
  await page.locator('#original-json-file').setInputFiles({ name: 'renamed.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await compare(page); await expect(page.locator('#removed-count')).toHaveText('0');
  await expect(page.locator('#remaining-count')).toHaveText('2 left to pull');
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await expect(page.locator('#completion-message')).toContainText('No removals needed');
});

test('requires explicit retry after a later alias page fails and never compares against a partial catalog', async ({ page }) => {
  let attempts = 0;
  const requests: string[] = [];
  await page.route(aliasRoute, (route) => {
    requests.push(route.request().url());
    if (!new URL(route.request().url()).searchParams.has('page')) {
      attempts += 1;
      return route.fulfill({ json: attempts === 1 ? firstPage : aliasPayload, headers: cors });
    }
    return route.fulfill({ status: 503, headers: cors });
  });
  await page.goto('./'); await paste(page, 'original', '1 Marauding Mutagen');
  await paste(page, 'target', '1 Acidic Slime'); await compare(page);
  await expect(page.locator('#comparison-notice')).toContainText('Retry before comparing');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#original-text')).toHaveValue('1 Marauding Mutagen');
  expect(requests).toHaveLength(2);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('#completion-message')).toContainText('No removals needed');
  expect(requests).toHaveLength(3); expect(attempts).toBe(2);
});

test('keeps the previous checklist and progress when an affected input has conflicting identities', async ({ page }) => {
  await page.route(aliasRoute, (route) => route.fulfill({ json: { ...aliasPayload, total_cards: 4, data: [
    ...aliasPayload.data, { ...slimeAliasCard, name: 'Different Card', oracle_id: '10000000-0000-0000-0000-000000000001' },
  ] }, headers: cors }));
  await page.goto('./'); await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  await page.locator('#original-text').fill('1 Marauding Mutagen'); await compare(page);
  await expect(page.locator('#comparison-notice')).toContainText('conflicting card identities');
  await expect(page.locator('#comparison-notice')).toContainText('previous checklist and progress are unchanged');
  await expect(page.locator('#removed-count')).toHaveText('1');
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest', "Kodama's Reach", 'Swiftfoot Boots']);
});

test('times out the alias check and ignores a late response after a session reset', async ({ page }) => {
  let held: Route | undefined;
  await page.route(aliasRoute, (route) => { held = route; });
  await page.goto('./'); await page.clock.install();
  await paste(page, 'original', '1 Marauding Mutagen'); await paste(page, 'target', '1 Acidic Slime'); await compare(page);
  await expect.poll(() => Boolean(held)).toBe(true);
  await expect(page.locator('#compare-button')).toHaveText('Checking alternate card names…↗');
  await page.clock.fastForward(15_001);
  await expect(page.locator('#comparison-notice')).toContainText('15 seconds');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.locator('#clear-session').click();
  await held?.fulfill({ json: aliasPayload, headers: cors }).catch(() => {});
  await expect(page.locator('#original-json')).toHaveValue('');
  await expect(page.locator('#comparison-notice')).toBeHidden();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#compare-button')).toBeEnabled();
});

test('editing inputs cancels an obsolete alias lookup without restoring its result', async ({ page }) => {
  let held: Route | undefined;
  await page.route(aliasRoute, (route) => { held = route; });
  await page.goto('./'); await paste(page, 'original', '1 Marauding Mutagen'); await paste(page, 'target', '1 Acidic Slime'); await compare(page);
  await expect.poll(() => Boolean(held)).toBe(true);
  await page.locator('#target-text').fill('1 Sol Ring');
  await held?.fulfill({ json: aliasPayload, headers: cors }).catch(() => {});
  await expect(page.locator('#results')).toBeHidden(); await expect(page.locator('#compare-button')).toBeEnabled();
  await page.unroute(aliasRoute);
  await page.route(aliasRoute, (route) => route.fulfill({ json: aliasPayload, headers: cors }));
  await compare(page);
  await expect(page.locator('.card-name')).toHaveText(['Marauding Mutagen (Acidic Slime)']);
});
