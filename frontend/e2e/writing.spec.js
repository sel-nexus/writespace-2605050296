/** Exercise real registration and owned writing across reload and mobile navigation. */
import { test, expect } from '@playwright/test';
for (const width of [375, 768, 1280]) {
  test(`signup/write/read/edit/cancel/delete at ${width}px`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Get Started Free' }).click();
    await page.getByLabel('Display name').fill('Journey Jane');
    await page.getByLabel('Username', { exact: true }).fill('journey-jane');
    await page.getByLabel('Password', { exact: true }).fill('demo-only');
    await page.getByLabel('Confirm password').fill('demo-only');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
    await page.getByRole('link', { name: 'Write a blog' }).click();
    const text = 'First line\n<script>alert("unsafe")</script>\nLast line';
    await page.getByLabel('Title', { exact: true }).fill('Journey post');
    await page.getByLabel('Content', { exact: true }).fill(text);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/blog\//);
    const original = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
    expect(original.content).toBe(text);
    expect(original.authorName).toBe('Journey Jane');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Journey post' })).toBeVisible();
    expect(await page.locator('article p').first().textContent()).toBe(text);
    await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Canceled title');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0])).toEqual(original);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Revised journey');
    await page.getByLabel('Content', { exact: true }).fill(text + '\nRevision');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const edited = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
    expect(edited).toEqual({ ...original, title: 'Revised journey', content: text + '\nRevision' });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Revised journey' })).toBeVisible();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Revised journey' })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
    if (width < 640) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
      await page.screenshot({ path: testInfo.outputPath('mobile-menu.png'), fullPage: true });
    }
    await page.getByRole('link', { name: 'Write', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Unsaved');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Journey Jane user/ }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test('guest edit deep link is guarded on initial entry and reload', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/edit/87015eb3-4386-4870-a91e-3a1bdf51d001');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: /Log in|Sign in/i })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: /Log in|Sign in/i })).toBeVisible();
  expect(errors).toEqual([]);
});
