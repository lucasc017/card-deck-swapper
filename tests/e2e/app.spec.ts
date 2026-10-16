import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { originalId, originalPayload, originalText, originalUrl, targetId, targetPayload, targetText, targetUrl } from '../fixtures/decks';

async function paste(page: Page, side: 'Original deck' | 'Target deck', text: string) {
  const card = page.getByRole('region', { name: side, exact: true });
  await card.getByRole('button', { name: 'Paste list', exact: true }).click();
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

test('compares two URLs with a validated mocked Moxfield response', async ({ page }) => {
  await page.route(`**/v3/decks/all/${originalId}`, (route) => route.fulfill({ json: originalPayload }));
  await page.route(`**/v3/decks/all/${targetId}`, (route) => route.fulfill({ json: targetPayload }));
  await page.locator('#original-url').fill(`${originalUrl}?sort=name#cards`);
  await page.locator('#target-url').fill(targetUrl);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#original-name')).toHaveText('Counters & company');
  await expect(page.locator('#target-name')).toHaveText('The next chapter');
  await expect(page.locator('#remaining-count')).toHaveText('6 left to pull');
  await expect(page.locator('.card-name')).toHaveText(['Cultivate', 'Forest', "Kodama's Reach", 'Swiftfoot Boots']);
});

test('recovers from a blocked URL import using a mixed URL and pasted comparison', async ({ page }) => {
  await page.route(`**/v3/decks/all/${originalId}`, (route) => route.fulfill({ json: originalPayload }));
  await page.route(`**/v3/decks/all/${targetId}`, (route) => route.fulfill({ status: 403, body: 'Forbidden' }));
  await page.locator('#original-url').fill(originalUrl);
  await page.locator('#target-url').fill(targetUrl);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.locator('#target-error')).toContainText('HTTP 403');
  await page.getByRole('button', { name: 'Use a pasted export instead' }).click();
  await expect(page.locator('#target-text')).toBeFocused();
  await expect(page.locator('#target-url')).toHaveValue(targetUrl);
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

test('changing an input cancels the old import and ignores stale results', async ({ page }) => {
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/v3/decks/all/${originalId}`, async (route) => {
    await waiting;
    await route.fulfill({ json: originalPayload }).catch(() => {});
  });
  await page.locator('#original-url').fill(originalUrl);
  await paste(page, 'Target deck', targetText);
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByRole('button', { name: 'Reading your decks' })).toBeDisabled();
  await paste(page, 'Original deck', '1 Sol Ring');
  await page.locator('#target-text').fill('1 Sol Ring');
  await page.getByRole('button', { name: 'Find cards to remove' }).click();
  await expect(page.getByText('No removals needed. Every card in your original deck can stay.')).toBeVisible();
  release?.();
  await expect(page.locator('#original-total')).toHaveText('1 card · mainboard + commanders');
  await expect(page.locator('.removal-row')).toHaveCount(0);
});
