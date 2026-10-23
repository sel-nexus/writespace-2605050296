/** Verify discovery routes and registration integrity against real local storage. */
import React from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import LandingPage from '../pages/LandingPage';
import RegisterPage from '../pages/RegisterPage';
import { PublicNavbar } from '../components/PublicNavbar';
const id = '73f3aefa-c002-46af-a3ec-32252ed78001';
const account = { id, displayName: 'Jane', username: 'jane', password: 'demo', role: 'user',
  createdAt: '2026-03-04T12:00:00.000Z' };
const identity = { userId: id, username: 'jane', displayName: 'Jane', role: 'user' };
/** Expose the observable route. */
function Location() { return <output aria-label="Location">{useLocation().pathname}</output>; }
/** Mount without unmount on success so replay remains testable. */
function mount(element, path = '/register') {
  return render(<MemoryRouter initialEntries={[path]}>{element}<Location /></MemoryRouter>);
}
/** Fill exact form bytes with ordinary user interactions. */
async function fill(values = {}) {
  const user = userEvent.setup();
  const data = { 'Display name': ' Jane ', Username: ' jane ', Password: ' demo ', 'Confirm password': ' demo ', ...values };
  for (const [label, value] of Object.entries(data)) {
    await user.clear(screen.getByLabelText(label));
    if (value) await user.type(screen.getByLabelText(label), value);
  }
  return screen.getByRole('button', { name: 'Create account' }).closest('form');
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
it.each([0, 1, 3, 4])('shows newest three of %s previews without changing bytes', (count) => {
  const posts = Array.from({ length: count }, (_, i) => ({
    id: '87015eb3-4386-4870-a91e-' + String(i).padStart(12, '0'), title: 'Post ' + i,
    content: 'x'.repeat(121), createdAt: '2026-03-0' + (i + 1) + 'T12:00:00.000Z', authorId: 'admin', authorName: 'Admin',
  }));
  const raw = JSON.stringify(posts);
  localStorage.setItem('writespace_posts', raw);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount(<LandingPage session={null} />, '/');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your thoughts. Your space. Beautifully simple.');
  for (const title of ['Write Freely', 'Private & Local', 'Instant & Fast']) expect(screen.getByText(title)).toBeInTheDocument();
  const links = screen.queryAllByRole('link', { name: /^Post / });
  expect(links.map((link) => link.textContent)).toEqual(posts.slice().reverse().slice(0, 3).map((post) => post.title));
  if (count) {
    expect(screen.getAllByText('x'.repeat(120))).toHaveLength(Math.min(3, count));
    expect(screen.getByText('Mar 0' + count + ', 2026')).toBeInTheDocument();
  } else expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  expect(within(screen.getByRole('navigation', { name: 'Footer' })).getAllByRole('link').map((link) => link.textContent))
    .toEqual(['Home', 'All Blogs', 'Login', 'Register']);
  expect(screen.getByText(/All rights reserved/)).toHaveTextContent(String(new Date().getFullYear()));
  expect(writes).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it.each(['{bad', '{}', '[{}]'])('falls back on invalid posts %s without repair', (raw) => {
  localStorage.setItem('writespace_posts', raw);
  mount(<LandingPage />);
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it.each([null, identity, { ...identity, role: 'admin' }])('routes public role CTAs for %j', (session) => {
  mount(<LandingPage session={session} />, '/');
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', session ? '/blogs' : '/login');
  expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
  if (session) expect(screen.getByRole('link', { name: 'Go to Dashboard' }))
    .toHaveAttribute('href', session.role === 'admin' ? '/admin' : '/blogs');
  else expect(screen.getByRole('link', { name: 'Get Started', exact: true })).toHaveAttribute('href', '/register');
});
it('toggles mobile disclosure, handles escape, and closes on link activation', async () => {
  mount(<PublicNavbar />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByRole('link', { name: 'Login' }));
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  fireEvent.keyDown(screen.getByRole('navigation'), { key: 'Escape' });
  expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
});
it('wires landing/register and protects guest previews', async () => {
  localStorage.setItem('writespace_posts', JSON.stringify([{ id, title: 'Preview', content: 'text',
    createdAt: account.createdAt, authorId: 'admin', authorName: 'Admin' }]));
  mount(<App />, '/');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Preview' }));
  expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
});
it.each(['Display name', 'Username', 'Password', 'Confirm password'])('rejects blank %s with zero writes', async (label) => {
  const callback = vi.fn();
  mount(<RegisterPage onSessionChange={callback} />);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  const form = await fill({ [label]: '   ' });
  fireEvent.submit(form);
  expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  expect(document.getElementById(screen.getByLabelText(label).getAttribute('aria-describedby')))
    .toHaveTextContent(label + ' is required.');
  expect(writes).not.toHaveBeenCalled();
  expect(callback).not.toHaveBeenCalled();
});
it.each(['admin', 'jane'])('rejects reserved or exact duplicate %s', async (username) => {
  localStorage.setItem('writespace_users', JSON.stringify([account]));
  mount(<RegisterPage onSessionChange={vi.fn()} />);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  fireEvent.submit(await fill({ Username: username }));
  expect(screen.getByRole('alert')).toHaveTextContent('Username already exists.');
  expect(writes).not.toHaveBeenCalled();
});
it('rejects mismatched exact password bytes then permits corrected submission', async () => {
  mount(<RegisterPage onSessionChange={vi.fn()} />);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  fireEvent.submit(await fill({ 'Confirm password': 'demo' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords must match.');
  expect(writes).not.toHaveBeenCalled();
  fireEvent.submit(await fill());
  expect(JSON.parse(localStorage.getItem('writespace_users'))).toHaveLength(1);
});
it('persists exact shape and bytes, account before session before callback', async () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
  const callback = vi.fn(() => expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual({
    userId: id, username: ' jane ', displayName: ' Jane ', role: 'user',
  }));
  mount(<RegisterPage onSessionChange={callback} />);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  fireEvent.submit(await fill());
  const saved = JSON.parse(localStorage.getItem('writespace_users'));
  expect(saved).toEqual([{ ...account, displayName: ' Jane ', username: ' jane ', password: ' demo ',
    createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/) }]);
  expect(writes.mock.calls.map(([key]) => key)).toEqual(['writespace_users', 'writespace_session']);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
});
it.each(['{bad', '{}', '[{}]', JSON.stringify([account, account]),
  JSON.stringify([{ ...account, role: 'root' }]), JSON.stringify([{ ...account, createdAt: 'bad' }])])(
  'does not destructively replace corrupt users %s', async (raw) => {
    localStorage.setItem('writespace_users', raw);
    mount(<RegisterPage onSessionChange={vi.fn()} />);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.submit(await fill());
    expect(screen.getByRole('alert')).toHaveTextContent('not saved');
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_users')).toBe(raw);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/register');
  },
);
it('retains input on denied reads with zero writes', async () => {
  mount(<RegisterPage onSessionChange={vi.fn()} />);
  const form = await fill();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  fireEvent.submit(form);
  expect(writes).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Username')).toHaveValue(' jane ');
  expect(screen.getByRole('alert')).toHaveTextContent('not saved');
});
it('permits explicit retry after account write fails', async () => {
  mount(<RegisterPage onSessionChange={vi.fn()} />);
  const form = await fill();
  const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  fireEvent.submit(form);
  expect(screen.getByRole('alert')).toHaveTextContent('not saved');
  expect(localStorage.getItem('writespace_users')).toBeNull();
  expect(screen.getByLabelText('Password')).toHaveValue(' demo ');
  writes.mockRestore();
  fireEvent.submit(form);
  expect(JSON.parse(localStorage.getItem('writespace_users'))).toHaveLength(1);
});
it.each([false, true])('blocks nested and sequential replay, partial=%s', async (partial) => {
  const callback = vi.fn();
  mount(<RegisterPage onSessionChange={callback} />);
  const form = await fill();
  const original = Storage.prototype.setItem;
  const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    fireEvent.submit(form);
    if (partial && key === 'writespace_session') throw Error('denied');
    original.call(this, key, value);
  });
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(writes).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem('writespace_users'))).toHaveLength(1);
  if (partial) {
    expect(callback).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/register');
    expect(screen.getByRole('alert')).toHaveTextContent('account was saved');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'different' } });
    fireEvent.submit(form);
    expect(writes).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('link', { name: 'Login' })[0]).toHaveAttribute('href', '/login');
  } else expect(callback).toHaveBeenCalledTimes(1);
});
it.each(['user', 'admin'])('redirects signed-in registration for %s without writes', (role) => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount(<RegisterPage session={{ ...identity, role }} onSessionChange={vi.fn()} />);
  expect(screen.getByLabelText('Location')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
  expect(writes).not.toHaveBeenCalled();
});
it('navigates signup via App and reloads persisted session', async () => {
  const view = mount(<App />, '/');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Get Started Free' }));
  expect(screen.getAllByRole('navigation', { name: 'Public' })).toHaveLength(1);
  fireEvent.submit(await fill());
  expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
  view.unmount();
  mount(<App />, '/');
  expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/blogs');
});
