import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { completeCommanderPayload, originalId, originalPayload, originalText, originalUrl, separatedCommanderText, targetId, targetPayload, targetText, targetUrl, truncatedCommanderJson } from '../fixtures/decks';

async function paste(page: Page, side: 'Original deck' | 'Target deck', text: string) {
  const card = page.getByRole('region', { name: side, exact: true });
  await card.getByRole('button', { name: 'Paste deck', exact: true }).click();
  await card.getByLabel('Deck export').fill(text);
}

async function comparePasted(page: Page) {
  await paste(page, 'Original deck', originalText);
  await paste(page, 'Target deck', targetText);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByRole('heading', { name: 'Your removal checklist' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('./');
});

test('loads the production assets and stays within the viewport in light and dark modes', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'New list. Make room for it.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find cards to remove' })).toHaveCSS('background-color', 'rgb(40, 86, 63)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(229, 233, 223)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('dark.png'), fullPage: true });
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('compares pasted lists and tracks each copy with undo, filtering and reset', async ({ page }, info) => {
  await comparePasted(page);
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest', "Kodama's Reach", 'Swiftfoot Boots']);
  await expect(page.locator('#remaining-count')).toHaveText('6 left to pull');
  await expect(page.getByText('10 cards · mainboard + commanders', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  const plus = page.getByRole('button', { name: 'Mark one Forest removed', exact: true });
  await plus.click(); await plus.click();
  await expect(page.getByText('2 of 3 removed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo one Forest removal' }).click();
  await expect(page.getByText('1 of 3 removed', { exact: true })).toBeVisible();
  await expect(page.locator('#removed-count')).toHaveText('2');
  await page.getByRole('checkbox', { name: 'Remaining only' }).check();
  await expect(page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true })).toBeHidden();
  await page.getByRole('checkbox', { name: 'Remaining only' }).uncheck();
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest', "Kodama's Reach", 'Swiftfoot Boots']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('checklist.png'), fullPage: true });
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(page.locator('#removed-count')).toHaveText('0');
  await expect(page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true })).not.toBeChecked();
});

test('supports keyboard removal, completion and restarting the session', async ({ page }) => {
  await comparePasted(page);
  const checkbox = page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true });
  await checkbox.focus(); await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked(); await expect(checkbox).toBeFocused();
  for (let copy = 0; copy < 3; copy++) await page.getByRole('button', { name: 'Mark one Forest removed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark one Forest removed', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: "Mark Kodama's Reach removed" }).check();
  await page.getByRole('checkbox', { name: 'Mark Swiftfoot Boots removed' }).check();
  await expect(page.getByText('All removals completed. Your deck has room for what’s next.')).toBeVisible();
  await page.getByRole('button', { name: 'Start over', exact: false }).filter({ hasText: /^Start over/u }).click();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#original-url')).toHaveValue('');
  await expect(page.locator('#original-url')).toBeFocused();
});

test('distinguishes identical decks from a completed removal session', async ({ page }) => {
  await paste(page, 'Original deck', '1 Sol Ring');
  await paste(page, 'Target deck', '1 Sol Ring\n1 Cultivate');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByText('No removals needed. Every card in your original deck can stay.')).toBeVisible();
  await expect(page.locator('.removal-row')).toHaveCount(0);
});

test('guides both API requests through separate browser tabs and compares pasted JSON', async ({ page, context }) => {
  const requests: { type: string; referrer: string | null }[] = [];
  await context.route('https://api2.moxfield.com/v3/decks/all/*', async (route) => {
    requests.push({ type: route.request().resourceType(), referrer: route.request().headers()['referer'] || null });
    await route.fulfill({ json: route.request().url().endsWith(originalId) ? originalPayload : targetPayload });
  });
  for (const [side, url, id, payload] of [
    ['original', `${originalUrl}?sort=name#cards`, originalId, originalPayload],
    ['target', targetUrl, targetId, targetPayload],
  ] as const) {
    await page.locator(`#${side}-url`).fill(url);
    const popupPromise = context.waitForEvent('page');
    await page.locator(`.deck-card-${side}`).getByRole('button', { name: 'Open API response in a new tab' }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    expect(popup.url()).toBe(`https://api2.moxfield.com/v3/decks/all/${id}`);
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await expect(popup.locator('body')).toContainText(payload.name);
    await popup.close();
    await page.locator(`#${side}-json`).fill(JSON.stringify(payload));
  }
  expect(requests).toEqual([{ type: 'document', referrer: null }, { type: 'document', referrer: null }]);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-name')).toHaveText('Counters & company');
  await expect(page.locator('#target-name')).toHaveText('The next chapter');
  await expect(page.locator('#remaining-count')).toHaveText('6 left to pull');
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest', "Kodama's Reach", 'Swiftfoot Boots']);
});

test('offers plain deck paste when the API tab is blocked, preserving the other JSON input', async ({ page, context }) => {
  await context.route(`**/v3/decks/all/${targetId}`, (route) => route.fulfill({ status: 403, body: 'Forbidden' }));
  await page.locator('#original-url').fill(originalUrl);
  await page.locator('#original-json').fill(JSON.stringify(originalPayload));
  await page.locator('#target-url').fill(targetUrl);
  const popupPromise = context.waitForEvent('page');
  const target = page.getByRole('region', { name: 'Target deck', exact: true });
  await target.getByRole('button', { name: 'Open API response in a new tab' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.locator('body')).toContainText('Forbidden');
  await popup.close();
  await target.getByRole('button', { name: 'API blocked? Paste your deck instead' }).click();
  await expect(page.locator('#target-text')).toBeFocused();
  await expect(page.locator('#target-url')).toHaveValue(targetUrl);
  await expect(page.locator('#original-json')).toHaveValue(JSON.stringify(originalPayload));
  await page.locator('#target-text').fill(targetText);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#remaining-count')).toHaveText('6 left to pull');
});

test('rejects bad text without replacing the previous checklist or progress', async ({ page }) => {
  await comparePasted(page);
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  await page.locator('#target-text').fill('Deck\n1 Sol Ring\nnot counted');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#target-error')).toContainText('Line 3');
  await expect(page.locator('#comparison-notice')).toContainText('previous checklist');
  await expect(page.locator('#removed-count')).toHaveText('1');
  await expect(page.locator('.removal-row')).toHaveCount(4);
});

test('clears memory on reload and writes no persistent browser state', async ({ page, context }) => {
  await comparePasted(page);
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  expect(await context.cookies()).toEqual([]);
  await page.reload();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#original-url')).toHaveValue('');
  await expect(page.locator('#original-text')).toHaveValue('');
  await expect(page.locator('#original-json')).toHaveValue('');
});

test('renders imported names as text and provides a working example', async ({ page }) => {
  await paste(page, 'Original deck', '1 <img src=x onerror=alert(1)>');
  await paste(page, 'Target deck', '1 Sol Ring');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('.card-name')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#removal-list img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.locator('#original-total')).toHaveText('100 cards · mainboard + commanders');
  await expect(page.locator('#target-total')).toHaveText('100 cards · mainboard + commanders');
  await expect(page.locator('#remaining-count')).toHaveText('6 left to pull');
});

test('changing the source link clears stale JSON and preserves the previous checklist on failure', async ({ page }) => {
  await page.locator('#original-url').fill(originalUrl);
  await page.locator('#original-json').fill(JSON.stringify(originalPayload));
  await paste(page, 'Target deck', targetText);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  await page.locator('#original-url').fill(targetUrl);
  await expect(page.locator('#original-json')).toHaveValue('');
  await expect(page.getByText('The link changed. Copy the API response for this deck again.')).toBeVisible();
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-error')).toContainText('Open the API response');
  await expect(page.locator('#removed-count')).toHaveText('1');
  await page.locator('#original-json').fill(JSON.stringify(targetPayload));
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByText('No removals needed. Every card in your original deck can stay.')).toBeVisible();
  await expect(page.locator('.removal-row')).toHaveCount(0);
});

test('accepts unlabeled commanders after the mainboard with exact quantities and punctuation', async ({ page }) => {
  await paste(page, 'Original deck', separatedCommanderText);
  await paste(page, 'Target deck', separatedCommanderText.replace('4 Forest', '1 Forest'));
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-total')).toHaveText('10 cards · mainboard + commanders');
  await expect(page.locator('#target-total')).toHaveText('7 cards · mainboard + commanders');
  await expect(page.locator('.card-name')).toHaveText(['Forest']);
  await expect(page.locator('#remaining-count')).toHaveText('3 left to pull');
});

test('recovers a plain card list pasted into the JSON field without losing it', async ({ page }) => {
  await page.locator('#original-json').fill(separatedCommanderText);
  await paste(page, 'Target deck', separatedCommanderText);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-error')).toContainText('not valid JSON');
  await page.getByRole('button', { name: 'Use a pasted deck instead' }).click();
  await expect(page.locator('#original-text')).toBeFocused();
  await expect(page.locator('#original-text')).toHaveValue(separatedCommanderText);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByText('No removals needed. Every card in your original deck can stay.')).toBeVisible();
});

test('incomplete JSON preserves removal progress, and an invalid API link opens no tab', async ({ page, context }) => {
  await comparePasted(page);
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  const target = page.getByRole('region', { name: 'Target deck', exact: true });
  await target.getByRole('button', { name: 'Guided API', exact: true }).click();
  await page.locator('#target-url').fill('https://example.com/decks/not-moxfield');
  await target.getByRole('button', { name: 'Open API response in a new tab' }).click();
  await expect(page.locator('#target-error')).toContainText('Use a Moxfield deck link');
  expect(context.pages()).toHaveLength(1);
  await page.locator('#target-url').fill(targetUrl);
  await page.locator('#target-json').fill('{"name":');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#target-error')).toContainText('appears cut off');
  await expect(page.locator('#removed-count')).toHaveText('1');
  await expect(page.locator('#target-json')).toHaveValue('{"name":');
});

test('recovers from truncated JSON with a large saved API response, entirely on the device', async ({ page }) => {
  await comparePasted(page);
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  const original = page.getByRole('region', { name: 'Original deck', exact: true });
  await original.getByRole('button', { name: 'Guided API', exact: true }).click();
  await page.locator('#original-url').fill(originalUrl);
  await page.locator('#original-json').fill(truncatedCommanderJson);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-error')).toContainText('appears cut off');
  await expect(page.locator('#removed-count')).toHaveText('1');

  const network: string[] = [];
  page.on('request', (request) => network.push(request.url()));
  const json = JSON.stringify({ ...completeCommanderPayload, description: 'Metadata '.repeat(70_000) });
  await original.getByLabel('Or choose a saved JSON file').setInputFiles({
    name: 'deck.json', mimeType: 'application/json', buffer: Buffer.from(json),
  });
  await expect(original.getByRole('status')).toContainText('Loaded locally · Complete Commander response · 100 cards');
  await expect(page.locator('#original-json')).toHaveValue(json);
  await expect(page.locator('#original-error')).toBeHidden();
  await expect(page.locator('#removed-count')).toHaveText('1');
  await paste(page, 'Target deck', '1 First Commander\n1 Second Commander\n1 Forest');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-total')).toHaveText('100 cards · mainboard + commanders');
  await expect(page.locator('#remaining-count')).toHaveText('97 left to pull');
  expect(network).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('#original-json')).toHaveValue('');
  await expect(page.locator('#results')).toBeHidden();
});

test('rejects an incomplete saved file and can load the corrected file under the same name', async ({ page }) => {
  const file = page.getByRole('region', { name: 'Original deck', exact: true }).getByLabel('Or choose a saved JSON file');
  await file.setInputFiles({ name: 'deck.json', mimeType: 'application/json', buffer: Buffer.from(truncatedCommanderJson) });
  await expect(page.locator('#original-error')).toContainText('appears cut off');
  await file.setInputFiles({ name: 'deck.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(originalPayload)) });
  await expect(page.getByText('✓ Loaded locally · Counters & company · 10 cards. Select Find cards to remove.', { exact: true })).toBeVisible();
  await expect(page.locator('#original-error')).toBeHidden();
});

test('starting over prevents an unfinished file read from restoring old deck data', async ({ page }) => {
  await comparePasted(page);
  const original = page.getByRole('region', { name: 'Original deck', exact: true });
  await original.getByRole('button', { name: 'Guided API', exact: true }).click();
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      return read.call(this).then((value) => new Promise<string>((resolve) => {
        Object.defineProperty(window, 'releaseSavedFile', { value: () => resolve(value), configurable: true });
      }));
    };
  });
  await original.getByLabel('Or choose a saved JSON file').setInputFiles({
    name: 'deck.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(originalPayload)),
  });
  await expect.poll(() => page.evaluate(() => 'releaseSavedFile' in window)).toBe(true);
  await page.locator('#clear-session').click();
  await page.evaluate(() => {
    const release: unknown = Reflect.get(window, 'releaseSavedFile');
    if (typeof release === 'function') release();
  });
  await expect(page.locator('#original-json')).toHaveValue('');
  await expect(original.getByRole('status')).toBeEmpty();
  await expect(page.locator('#results')).toBeHidden();
});

test('swaps pasted decks in both directions and resets progress and filtering with keyboard focus preserved', async ({ page }) => {
  await comparePasted(page);
  await page.getByRole('checkbox', { name: 'Mark Cultivate removed', exact: true }).check();
  await page.getByRole('button', { name: 'Mark one Forest removed', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Remaining only' }).check();
  const swap = page.getByRole('button', { name: 'Swap decks', exact: true });
  await swap.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#original-text')).toHaveValue(targetText);
  await expect(page.locator('#target-text')).toHaveValue(originalText);
  await expect(page.locator('#original-total')).toHaveText('5 cards · mainboard + commanders');
  await expect(page.locator('#target-total')).toHaveText('10 cards · mainboard + commanders');
  await expect(page.locator('.card-name')).toHaveText(['Swords to Plowshares']);
  await expect(page.locator('#remaining-count')).toHaveText('1 left to pull');
  await expect(page.locator('#removed-count')).toHaveText('0');
  await expect(page.getByRole('checkbox', { name: 'Remaining only' })).not.toBeChecked();
  await expect(swap).toBeFocused();
  await expect(page.locator('#swap-announcement')).toContainText('Decks swapped');
  await page.getByRole('checkbox', { name: 'Mark Swords to Plowshares removed', exact: true }).check();
  await swap.click();
  await expect(page.locator('#original-text')).toHaveValue(originalText);
  await expect(page.locator('#target-text')).toHaveValue(targetText);
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest', "Kodama's Reach", 'Swiftfoot Boots']);
  await expect(page.locator('#remaining-count')).toHaveText('6 left to pull');
  await expect(page.locator('#removed-count')).toHaveText('0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('swaps both API responses with their matching URLs and deck names', async ({ page }) => {
  await page.locator('#original-url').fill(originalUrl);
  await page.locator('#original-json').fill(JSON.stringify(originalPayload));
  await page.locator('#target-url').fill(targetUrl);
  await page.locator('#target-json').fill(JSON.stringify(targetPayload));
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await expect(page.locator('#original-name')).toHaveText('The next chapter');
  await expect(page.locator('#target-name')).toHaveText('Counters & company');
  await expect(page.locator('#original-url')).toHaveValue(targetUrl);
  await expect(page.locator('#target-url')).toHaveValue(originalUrl);
  await expect(page.locator('#original-json')).toHaveValue(JSON.stringify(targetPayload));
  await expect(page.locator('#target-json')).toHaveValue(JSON.stringify(originalPayload));
  await expect(page.locator('.card-name')).toHaveText(['Swords to Plowshares']);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#comparison-notice')).toBeHidden();
  await expect(page.locator('#remaining-count')).toHaveText('1 left to pull');
  expect(requests).toEqual([]);
});

test('swaps saved JSON and pasted text, recovering the last compared pair after an invalid edit', async ({ page }) => {
  const original = page.getByRole('region', { name: 'Original deck', exact: true });
  const target = page.getByRole('region', { name: 'Target deck', exact: true });
  await page.locator('#original-url').fill(originalUrl);
  await original.getByLabel('Or choose a saved JSON file').setInputFiles({
    name: 'deck.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(originalPayload)),
  });
  await expect(original.getByRole('status')).toContainText('Loaded locally');
  await paste(page, 'Target deck', targetText);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await expect(original.getByRole('button', { name: 'Paste deck', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(target.getByRole('button', { name: 'Guided API', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#target-url')).toHaveValue(originalUrl);
  await expect(page.locator('#target-json')).toHaveValue(JSON.stringify(originalPayload));
  await expect(page.locator('#original-text')).toHaveValue(targetText);
  await expect(page.locator('#target-name')).toHaveText('Counters & company');
  await page.getByRole('checkbox', { name: 'Mark Swords to Plowshares removed', exact: true }).check();
  await page.locator('#target-json').fill(truncatedCommanderJson);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#target-error')).toBeVisible();
  await expect(page.locator('#removed-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await expect(page.locator('#original-json')).toHaveValue(JSON.stringify(originalPayload));
  await expect(page.locator('#target-text')).toHaveValue(targetText);
  await expect(original.getByRole('button', { name: 'Guided API', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(target.getByRole('button', { name: 'Paste deck', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#original-name')).toHaveText('Counters & company');
  await expect(page.locator('#target-error')).toBeHidden();
  await expect(page.locator('#comparison-notice')).toBeHidden();
  await expect(page.locator('#remaining-count')).toHaveText('6 left to pull');
  await expect(page.locator('#removed-count')).toHaveText('0');
});

test('can reverse a comparison that initially needs no removals', async ({ page }) => {
  await paste(page, 'Original deck', '1 Sol Ring');
  await paste(page, 'Target deck', '1 Sol Ring\n1 Cultivate');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByText('No removals needed. Every card in your original deck can stay.')).toBeVisible();
  await page.getByRole('button', { name: 'Swap decks', exact: true }).click();
  await expect(page.locator('.card-name')).toHaveText(['Cultivate']);
  await expect(page.locator('#remaining-count')).toHaveText('1 left to pull');
  await expect(page.locator('#removed-count')).toHaveText('0');
});
