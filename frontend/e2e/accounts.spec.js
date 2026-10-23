/** Verify account management through real browser actions and persisted state. */
import { test, expect } from '@playwright/test';

/** Capture errors before entering the application. */
test.beforeEach(async ({ page }) => {
  page.accountErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') page.accountErrors.push(message.text()); });
  page.on('pageerror', (error) => page.accountErrors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(page.accountErrors).toEqual([]); });

/** Sign in using the visible entry form. */
async function login(page, username, password) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
/** Read the complete stored account collection. */
async function accounts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users') || '[]'));
}
/** Open the explicit account disclosure and log out. */
async function logout(page, name) {
  await page.getByRole('button', { name: name + ' admin', exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
}

test('admin creates both roles, cancels and confirms deletion, stored admin self protection and mobile reload', async ({ page }, testInfo) => {
  await page.goto('/login');
  expect(await accounts(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  const postsBefore = await page.evaluate(() => localStorage.getItem('writespace_posts'));
  await login(page, 'admin', 'admin');
  await expect(page).toHaveURL(/[/]admin$/);
  const sessionBefore = await page.evaluate(() => localStorage.getItem('writespace_session'));
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
  await expect(page.locator('table').getByRole('button', { name: 'Delete admin', exact: true })).toBeDisabled();
  for (const role of ['user', 'admin']) {
    await page.getByLabel('Display name', { exact: true }).fill('Demo ' + role);
    await page.getByLabel('Username', { exact: true }).fill('demo-' + role);
    await page.getByLabel('Password', { exact: true }).fill('demo-only');
    await page.getByLabel('Role', { exact: true }).selectOption(role);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Account created.');
    const saved = await accounts(page);
    expect(saved.at(-1)).toEqual({ id: expect.stringMatching(/^[a-f0-9-]{36}$/), displayName: 'Demo ' + role,
      username: 'demo-' + role, password: 'demo-only', role, createdAt: expect.any(String) });
    expect(new Date(saved.at(-1).createdAt).toISOString()).toBe(saved.at(-1).createdAt);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(sessionBefore);
  }
  const beforeDelete = await accounts(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('table').getByRole('button', { name: 'Delete demo-user', exact: true }).click();
  expect(await accounts(page)).toEqual(beforeDelete);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('table').getByRole('button', { name: 'Delete demo-user', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Account deleted.');
  expect(await accounts(page)).toEqual([beforeDelete[1]]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(postsBefore);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(sessionBefore);
  await logout(page, 'Admin');
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await login(page, 'demo-admin', 'demo-only');
  await expect(page).toHaveURL(/[/]admin$/);
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.locator('table').getByRole('button', { name: 'Delete demo-admin', exact: true })).toBeDisabled();
  const storedSession = await page.evaluate(() => localStorage.getItem('writespace_session'));
  expect(JSON.parse(storedSession)).toEqual({ userId: beforeDelete[1].id, username: 'demo-admin', displayName: 'Demo admin', role: 'admin' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByRole('article', { name: 'Account demo-admin' }).getByRole('button')).toBeDisabled();
  await expect(page.getByRole('article', { name: 'Account admin' }).getByRole('button')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  expect(await accounts(page)).toEqual([beforeDelete[1]]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(storedSession);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(postsBefore);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('accounts-mobile.png'), fullPage: true });
});
