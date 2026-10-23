/** Exercise admin login and cross-feature oversight with persistent browser records. */
import { test, expect } from '@playwright/test';
const uid = '73f3aefa-c002-46af-a3ec-32252ed78001';
const pid = '87015eb3-4386-4870-a91e-3a1bdf51d001';
for (const width of [375, 1280]) {
  test('administrator writing and non-owner oversight at ' + width + 'px', async ({ page }, testInfo) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const original = { id: pid, title: 'Jane original', content: 'Jane writing\nSecond line',
      createdAt: '2026-03-04T12:00:00.000Z', authorId: uid, authorName: 'Jane' };
    await page.evaluate(({ original, uid }) => {
      localStorage.setItem('writespace_posts', JSON.stringify([original]));
      localStorage.setItem('writespace_users', JSON.stringify([{ id: uid, username: 'jane', displayName: 'Jane',
        password: 'demo-only', role: 'user', createdAt: original.createdAt }]));
    }, { original, uid });
    await page.getByRole('link', { name: 'Login', exact: true }).first().click();
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: /Log in|Sign in/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    for (const [label, value] of [['Total Posts', '1'], ['Total Users', '2'], ['Total Admins', '1'], ['Total users', '2']]) {
      await expect(page.locator('dl div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(value);
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Jane original' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([original]);
    if (width === 375) await page.screenshot({ path: testInfo.outputPath('mobile-admin-dashboard.png'), fullPage: true });
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/edit/' + pid + '$'));
    await page.getByLabel('Title', { exact: true }).fill('Admin revision');
    await page.getByLabel('Content', { exact: true }).fill('Revised by admin\nStill Jane');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const edited = { ...original, title: 'Admin revision', content: 'Revised by admin\nStill Jane' };
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([edited]);
    if (width === 375) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'Write a blog' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Admin new post');
    await page.getByLabel('Content', { exact: true }).fill('Local admin writing');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.reload();
    const created = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')).find((post) => post.authorId === 'admin'));
    expect(created).toMatchObject({ title: 'Admin new post', content: 'Local admin writing', authorId: 'admin', authorName: 'Admin' });
    if (width === 375) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete Admin revision', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([edited, created]);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete Admin revision', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([created]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toHaveLength(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe('admin');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
