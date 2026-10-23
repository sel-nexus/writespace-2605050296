/** Focused responsive, keyboard and source-preflight evidence; no network mocks. */
import { test, expect } from '@playwright/test';

const widths = [375, 639, 640, 767, 768, 1024];
const posts = [0, 1, 2].map((index) => ({
  id: '87015eb3-4386-4870-a91e-' + String(index).padStart(12, '0'),
  title: 'Interface post ' + index, content: 'Readable browser-local content.',
  createdAt: '2026-03-04T12:00:00.000Z', authorId: 'admin', authorName: 'Admin',
}));

test.beforeEach(async ({ page }) => {
  page.interfaceErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') page.interfaceErrors.push(message.text());
  });
  page.on('pageerror', (error) => page.interfaceErrors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(page.interfaceErrors).toEqual([]);
});

/** Attach inspectable structure/styles/tree plus a screenshot for human review. */
async function preflight(page, info, state) {
  const tree = await page.accessibility.snapshot();
  const styles = await page.evaluate(() => [...document.querySelectorAll(
    'main, h1, .grid, button, a, table, [aria-expanded], .animate-bounce',
  )].map((element) => {
    const css = getComputedStyle(element);
    return { tag: element.tagName, text: element.textContent.slice(0, 100),
      display: css.display, columns: css.gridTemplateColumns, overflowX: css.overflowX,
      animation: css.animationName, boxShadow: css.boxShadow, outline: css.outline,
      color: css.color, background: css.backgroundColor };
  }));
  await info.attach(state + '-accessibility', {
    body: JSON.stringify(tree, null, 2), contentType: 'application/json',
  });
  await info.attach(state + '-styles', {
    body: JSON.stringify(styles, null, 2), contentType: 'application/json',
  });
  await info.attach(state + '-html', { body: await page.content(), contentType: 'text/html' });
  await info.attach(state + '-screenshot', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
}

async function loginAdmin(page) {
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/[/]admin$/);
}
async function noPageOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function columns(grid, count) {
  await expect(grid).toBeVisible();
  expect(await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(count);
}

for (const width of widths) {
  test('grid boundaries and account presentation at ' + width + 'px', async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((records) => {
      localStorage.setItem('writespace_posts', JSON.stringify(records));
    }, posts);
    await page.goto('/');
    await columns(page.getByRole('region', { name: 'Features' }), width < 768 ? 1 : 3);
    if (width < 640) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await loginAdmin(page);
    await columns(page.locator('main dl.grid'), width < 640 ? 1 : width < 1024 ? 2 : 4);
    await preflight(page, info, 'dashboard-' + width);
    if (width < 640) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'All Blogs', exact: true }).click();
    await expect(page.getByRole('link', { name: /^Interface post / })).toHaveCount(3);
    // LLD requires md (768px), not sm (640px), for the two-column blog boundary.
    await columns(page.locator('main .grid'), width < 768 ? 1 : width < 1024 ? 2 : 3);
    await noPageOverflow(page);
    await preflight(page, info, 'blogs-' + width);
    if (width < 640) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    const cards = page.locator('[aria-label="Account cards"]');
    const table = page.getByRole('table', { name: 'Accounts', includeHidden: true });
    if (width < 640) {
      await expect(cards).toBeVisible();
      await expect(cards.getByRole('article', { name: 'Account admin' })).toBeVisible();
      await expect(table).toBeHidden();
    } else {
      await expect(cards).toBeHidden();
      await expect(table).toBeVisible();
      expect(await table.locator('..').evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
    }
    await columns(page.getByRole('form', { name: 'Create account' }), width < 640 ? 1 : 2);
    const form = page.getByRole('form', { name: 'Create account' });
    const submit = form.getByRole('button', { name: 'Create account', exact: true });
    await expect(submit).toBeVisible();
    await expect(submit).toHaveCSS('justify-self', 'start');
    const buttonBox = await submit.boundingBox();
    const firstFieldBox = await form.getByLabel('Display name').boundingBox();
    const lastFieldBox = await form.getByLabel('Role', { exact: true }).boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(firstFieldBox).not.toBeNull();
    expect(lastFieldBox).not.toBeNull();
    expect(Math.abs(buttonBox.x - firstFieldBox.x)).toBeLessThanOrEqual(1);
    expect(buttonBox.width).toBeLessThan(firstFieldBox.width);
    expect(buttonBox.y).toBeGreaterThan(lastFieldBox.y + lastFieldBox.height);
    await noPageOverflow(page);
    await preflight(page, info, 'accounts-' + width);
  });
}

test('keyboard public and workspace disclosures expose focus and close on navigation', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'WriteSpace' })).toBeFocused();
  expect(await page.getByRole('link', { name: 'WriteSpace' }).evaluate((element) =>
    getComputedStyle(element).boxShadow)).not.toBe('none');
  await page.keyboard.press('Tab');
  const publicMenu = page.getByRole('button', { name: 'Open menu' });
  await expect(publicMenu).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await preflight(page, info, 'public-open');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Login', exact: true }).first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await loginAdmin(page);
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'All Blogs', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/[/]blogs$/);
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  const identity = page.locator('button[aria-controls="account-actions"]');
  await identity.focus();
  await page.keyboard.press('Enter');
  await expect(identity).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Logout' })).toBeFocused();
  await preflight(page, info, 'account-open-empty-blogs');
  await page.keyboard.press('Escape');
  await expect(identity).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
  await identity.click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/[/]$/);
});

test('reduced motion disables decorative bounce and entry errors remain inspectable', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.locator('.animate-bounce')).toHaveCSS('animation-name', 'none');
  await preflight(page, info, 'desktop-reduced-motion-empty');
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Display name')).toHaveAttribute('aria-invalid', 'true');
  await preflight(page, info, 'registration-errors');
});
