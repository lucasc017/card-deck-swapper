import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { moxfieldFixture } from '../fixtures/decks';
import { preconCatalogPayload, preconEntry, preconPayload, upgradedPreconText } from '../fixtures/precons';

const api = 'https://mtgjson.com/api/v5/';
const catalogUrl = `${api}DeckList.json`;
const deckUrl = `${api}decks/${preconEntry.id}.json`;
const original = (page: Page) => page.getByRole('region', { name: 'Original deck', exact: true });

async function mockProvider(page: Page) {
  const requests: string[] = [];
  await page.route(`${api}**`, async (route) => {
    requests.push(route.request().url());
    expect(route.request().method()).toBe('GET');
    expect(route.request().postData()).toBeNull();
    await route.fulfill({
      json: route.request().url() === catalogUrl ? preconCatalogPayload : preconPayload,
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  return requests;
}

async function selectPrecon(page: Page) {
  await original(page).getByRole('button', { name: 'Choose precon', exact: true }).click();
  await original(page).getByLabel('Stock precon', { exact: true }).selectOption(preconEntry.id);
  await expect(page.locator('#original-precon-preview')).toContainText('Forest Friends · 100 cards');
}

async function pasteUpgrade(page: Page) {
  const target = page.getByRole('region', { name: 'Target deck', exact: true });
  await target.getByRole('button', { name: 'Paste deck', exact: true }).click();
  await target.getByLabel('Deck export').fill(upgradedPreconText);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
});

test('loads only the requested catalog and deck, supports search and editions, and compares an upgrade', async ({ page }, info) => {
  const requests = await mockProvider(page);
  await page.goto('./');
  expect(requests).toEqual([]);
  await original(page).getByRole('button', { name: 'Choose precon', exact: true }).click();
  const select = original(page).getByLabel('Stock precon', { exact: true });
  await expect(select.locator('option')).toHaveCount(4);
  await expect(select.locator('option')).toHaveText([
    'Choose a stock precon…', 'Island Allies · NEW · 2026', 'Forest Friends · TST · 2025', "Forest Friends Collector's Edition · TST · 2025",
  ]);
  expect(requests).toEqual([catalogUrl]);
  await original(page).getByLabel('Search Commander precons').fill('no such deck');
  await expect(page.locator('#original-precon-status')).toHaveText('No precons match this search.');
  await expect(select).toHaveValue('');
  await original(page).getByLabel('Search Commander precons').fill('tst');
  await expect(select.locator('option')).toHaveCount(3);
  await expect(select).toHaveValue('');
  await select.selectOption(preconEntry.id);
  await expect(page.locator('#original-precon-preview')).toContainText('Commanders: First Commander; Second Commander.');
  await pasteUpgrade(page);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-name')).toHaveText('Forest Friends');
  await expect(page.locator('#original-total')).toHaveText('100 cards · mainboard + commanders');
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest']);
  await expect(page.locator('#remaining-count')).toHaveText('2 left to pull');
  expect(requests).toEqual([catalogUrl, deckUrl]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('precon-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(select).toHaveCSS('color', 'rgb(229, 233, 223)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('precon-dark.png'), fullPage: true });
});

test('swaps the last successful precon pair without network access and preserves dormant inputs', async ({ page }) => {
  const requests = await mockProvider(page);
  await page.goto('./');
  await original(page).getByRole('button', { name: 'Paste deck', exact: true }).click();
  await page.locator('#original-text').fill('1 Dormant card');
  await selectPrecon(page); await pasteUpgrade(page);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Remaining only' }).check();
  await page.locator('#original-precon').selectOption('');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-precon-error')).toContainText('Choose a stock precon');
  await expect(page.locator('#removed-count')).toHaveText('1');
  const swap = page.getByRole('button', { name: 'Swap decks', exact: true });
  await swap.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#target-precon')).toHaveValue(preconEntry.id);
  await expect(page.locator('#original-text')).toHaveValue(upgradedPreconText);
  await expect(page.locator('#target-name')).toHaveText('Forest Friends');
  await expect(page.locator('.card-name')).toHaveText(['Command Tower', "Nature's Lore"]);
  await expect(page.locator('#removed-count')).toHaveText('0');
  await expect(page.getByRole('checkbox', { name: 'Remaining only' })).not.toBeChecked();
  await expect(swap).toBeFocused();
  await swap.click();
  await expect(page.locator('#original-precon')).toHaveValue(preconEntry.id);
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest']);
  await original(page).getByRole('button', { name: 'Paste deck', exact: true }).click();
  await expect(page.locator('#original-text')).toHaveValue('1 Dormant card');
  await original(page).getByRole('button', { name: 'Choose precon', exact: true }).click();
  await expect(page.locator('#original-precon')).toHaveValue(preconEntry.id);
  expect(requests).toEqual([catalogUrl, deckUrl]);
});

test('accepts guided JSON and saved JSON as the upgraded list', async ({ page }) => {
  await mockProvider(page); await page.goto('./'); await selectPrecon(page);
  const upgrade = moxfieldFixture('My upgrade', [['Forest', 93], ['Sol Ring', 1]], [['First Commander', 1], ['Second Commander', 1]]);
  await page.locator('#target-json').fill(JSON.stringify(upgrade));
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#target-name')).toHaveText('My upgrade');
  await expect(page.locator('#remaining-count')).toHaveText('4 left to pull');
  await page.getByLabel('Or choose a saved JSON file').last().setInputFiles({
    name: 'upgrade.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...upgrade, name: 'Saved upgrade' })),
  });
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#target-name')).toHaveText('Saved upgrade');
});

test('offers an explicit retry for a failed catalog and deck, preserving the previous checklist', async ({ page }) => {
  await mockProvider(page);
  let catalogAttempts = 0;
  let deckAttempts = 0;
  await page.route(catalogUrl, async (route) => {
    catalogAttempts += 1;
    if (catalogAttempts === 1) await route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } });
    else await route.fallback();
  });
  await page.route(deckUrl, async (route) => {
    deckAttempts += 1;
    if (deckAttempts === 1) await route.fulfill({ json: { data: { ...preconPayload.data, mainBoard: [] } }, headers: { 'access-control-allow-origin': '*' } });
    else await route.fallback();
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  await original(page).getByRole('button', { name: 'Choose precon', exact: true }).click();
  await expect(page.locator('#original-precon-error')).toContainText('MTGJSON could not be reached');
  await original(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await page.locator('#original-precon').selectOption(preconEntry.id);
  await expect(page.locator('#original-precon-error')).toContainText('incomplete or unsupported');
  await expect(page.locator('#removed-count')).toHaveText('1');
  await original(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('#original-precon-preview')).toContainText('100 cards');
  expect(catalogAttempts).toBe(2); expect(deckAttempts).toBe(2);
  await pasteUpgrade(page); await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest']);
  await expect(page.locator('#removed-count')).toHaveText('0');
});

test('times out slow provider requests and allows retry', async ({ page }) => {
  await mockProvider(page);
  let held: Route | undefined;
  await page.route(catalogUrl, (route) => { held = route; });
  await page.goto('./'); await page.clock.install();
  await original(page).getByRole('button', { name: 'Choose precon', exact: true }).click();
  await expect.poll(() => Boolean(held)).toBe(true);
  await page.clock.fastForward(15_001);
  await expect(page.locator('#original-precon-error')).toContainText('15 seconds');
  await page.unroute(catalogUrl);
  await original(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('#original-precon option')).toHaveCount(4);
});

test('ignores late deck and catalog responses after source changes and reset', async ({ page }) => {
  await mockProvider(page);
  let heldDeck: Route | undefined;
  await page.route(deckUrl, (route) => { heldDeck = route; });
  await page.goto('./');
  await original(page).getByRole('button', { name: 'Choose precon', exact: true }).click();
  await page.locator('#original-precon').selectOption(preconEntry.id);
  await expect.poll(() => Boolean(heldDeck)).toBe(true);
  await pasteUpgrade(page); await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByRole('button', { name: 'Reading your decks' })).toBeDisabled();
  await page.locator('#clear-session').click();
  await heldDeck?.fulfill({ json: preconPayload, headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
  await expect(page.locator('#original-precon-preview')).toBeEmpty();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#original-json')).toHaveValue('');
  await expect(page.locator('#compare-button')).toBeEnabled();

  // A fresh page has no cached catalog. Changing source must ignore its late response.
  let heldCatalog: Route | undefined;
  await page.route(catalogUrl, (route) => { heldCatalog = route; });
  await page.reload();
  await original(page).getByRole('button', { name: 'Choose precon', exact: true }).click();
  await expect.poll(() => Boolean(heldCatalog)).toBe(true);
  await original(page).getByRole('button', { name: 'Paste deck', exact: true }).click();
  await page.locator('#original-text').fill('1 Sol Ring');
  await heldCatalog?.fulfill({ json: preconCatalogPayload, headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
  await expect(page.locator('#original-precon-error')).toBeHidden();
  await expect(page.locator('#original-text')).toHaveValue('1 Sol Ring');
  await expect(page.locator('#original-text')).toBeVisible();
});
