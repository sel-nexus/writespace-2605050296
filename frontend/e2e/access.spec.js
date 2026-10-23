/** Verify access-only journeys against a built production frontend. */
import { test, expect } from '@playwright/test';

/** Capture browser errors before initial entry and assert them after every test. */
test.beforeEach(async ({ page }) => {
  page.accessErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') page.accessErrors.push(message.text());
  });
  page.on('pageerror', (error) => page.accessErrors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(page.accessErrors).toEqual([]);
});

test('admin entry, invalid attempt, navigation, reload persistence and logout', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveURL(/[/]$/);
  await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Public' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/[/]login$/);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/[/]admin$/);
  const expected = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(expected);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await page.getByRole('link', { name: 'All Blogs' }).click();
  await expect(page).toHaveURL(/[/]blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/[/]blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  await expect(page.getByText('Admin', { exact: true }).last()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(expected);
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-access.png'), fullPage: true });
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/[/]users$/);
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(expected);
  await page.getByRole('button', { name: 'Admin admin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Admin admin', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/[/]$/);
  await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.reload();
  await expect(page).toHaveURL(/[/]$/);
  await expect(page.getByRole('heading', { name: 'Your thoughts. Your space. Beautifully simple.' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});

test('mobile guest deep-entry guard and accessible login', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/users');
  await expect(page).toHaveURL(/[/]login$/);
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByText(/Credentials are stored in plaintext/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-guest-access.png'), fullPage: true });
});
