/** Exercise discovery and registration through real browser navigation. */
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  page.discoveryErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') page.discoveryErrors.push(message.text()); });
  page.on('pageerror', (error) => page.discoveryErrors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(page.discoveryErrors).toEqual([]); });
test('landing signup, exact local records, reload, dashboard CTA and logout', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await page.getByLabel('Display name').fill(' Jane ');
  await page.getByLabel('Username').fill(' jane ');
  await page.getByLabel('Password', { exact: true }).fill(' demo ');
  await page.getByLabel('Confirm password').fill(' demo ');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/[/]blogs$/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), displayName: ' Jane ',
    username: ' jane ', password: ' demo ', role: 'user', createdAt: expect.stringMatching(/^\d{4}-.*Z$/) });
  const identity = { userId: saved[0].id, username: ' jane ', displayName: ' Jane ', role: 'user' };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(identity);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(saved);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(identity);
  await page.getByRole('link', { name: 'WriteSpace' }).click();
  await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/[/]blogs$/);
  const identityDropdown = page.locator('button[aria-controls="account-actions"]');
  await expect(identityDropdown).toHaveAttribute('aria-expanded', 'false');
  await identityDropdown.click();
  await expect(identityDropdown).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('link', { name: 'Get Started Free' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('landing.png'), fullPage: true });
});
test('mobile menu and invalid registration retain input with no persisted records', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Display name')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Display name').fill('Jane');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm password').fill('other');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Passwords must match.')).toBeVisible();
  await page.getByLabel('Confirm password').fill('demo');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Username already exists.')).toBeVisible();
  await expect(page.getByLabel('Username')).toHaveValue('admin');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-invalid-registration.png'), fullPage: true });
  await page.getByRole('link', { name: 'Login', exact: true }).last().click();
  await expect(page).toHaveURL(/[/]login$/);
});
test('four unsorted fixture posts show newest three and guest reader guard', async ({ page }) => {
  const posts = [1, 3, 0, 2].map((i) => ({ id: '87015eb3-4386-4870-a91e-' + String(i).padStart(12, '0'),
    title: 'Fixture ' + i, content: 'x'.repeat(121), createdAt: '2026-03-0' + (i + 1) + 'T12:00:00.000Z',
    authorId: 'admin', authorName: 'Admin' }));
  await page.addInitScript((records) => localStorage.setItem('writespace_posts', JSON.stringify(records)), posts);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^Fixture / })).toHaveText(['Fixture 3', 'Fixture 2', 'Fixture 1']);
  await expect(page.getByText('x'.repeat(120), { exact: true })).toHaveCount(3);
  await expect(page.getByText('Mar 04, 2026')).toBeVisible();
  await page.getByRole('link', { name: 'Fixture 3' }).click();
  await expect(page).toHaveURL(/[/]login$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
});
