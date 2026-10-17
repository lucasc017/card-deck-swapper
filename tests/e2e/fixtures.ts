import { test as base, expect } from '@playwright/test';
import { aliasPayload } from '../fixtures/aliases';

export const test = base.extend<{ mockAliases: void }>({
  mockAliases: [async ({ page }, use) => {
    await page.route('https://api.scryfall.com/cards/search**', (route) => route.fulfill({
      json: aliasPayload, headers: { 'access-control-allow-origin': '*' },
    }));
    await use();
  }, { auto: true }],
});
export { expect };
