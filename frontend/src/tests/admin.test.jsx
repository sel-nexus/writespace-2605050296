/** Verify administrator oversight, guards, and non-destructive failure branches. */
import React from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import AdminDashboard from '../pages/AdminDashboard';
import { StatCard } from '../components/StatCard';
const uid = '73f3aefa-c002-46af-a3ec-32252ed78001';
const pid = '87015eb3-4386-4870-a91e-3a1bdf51d001';
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const user = { userId: uid, username: 'jane', displayName: 'Jane', role: 'user' };
const post = { id: pid, title: 'Other author', content: 'Literal preview', createdAt: '2026-03-04T12:00:00.000Z', authorId: uid, authorName: 'Original Jane' };
const account = { id: uid, username: 'jane', displayName: 'Jane', password: 'demo', role: 'user', createdAt: post.createdAt };
/** Expose navigation as a public observable. */
function Location() {
  return (
    <output aria-label="Location">{useLocation().pathname}</output>
  );
}
/** Mount actual application routes unless exercising the action latch directly. */
function mount(path = '/admin', element = <App />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {element}
      <Location />
    </MemoryRouter>
  );
}
/** Read the value associated with a literal statistic term. */
function count(label) { return screen.getByText(label, { selector: 'dt' }).nextElementSibling.textContent; }
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('writespace_session', JSON.stringify(admin));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
it.each([null, '{bad', '{}', JSON.stringify({ ...admin, role: 'unknown' }), JSON.stringify(user)])('guards invalid or non-admin identity %s', (raw) => {
  if (raw === null) localStorage.removeItem('writespace_session');
  else localStorage.setItem('writespace_session', raw);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getByLabelText('Location').textContent).toBe(raw === JSON.stringify(user) ? '/blogs' : '/login');
  expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).toBeNull();
  expect(writes).not.toHaveBeenCalled();
});
it.each([admin, { ...user, role: 'admin' }])('allows either administrator identity and counts every account once', (actor) => {
  localStorage.setItem('writespace_session', JSON.stringify(actor));
  localStorage.setItem('writespace_users', JSON.stringify([account, { ...account, id: pid, username: 'alex', role: 'admin' }]));
  localStorage.setItem('writespace_posts', JSON.stringify([post]));
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  const confirm = vi.spyOn(window, 'confirm');
  mount();
  expect(['Total Posts', 'Total Users', 'Total Admins', 'Total users'].map(count)).toEqual(['1', '3', '2', '3']);
  expect(screen.getByText('Original Jane')).toBeInTheDocument();
  expect(screen.getByText('Mar 04, 2026')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/edit/' + pid);
  expect(writes).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});
it.each([null, '[]', '{bad', 'null', '{}', '[{}]'])('keeps corrupt or empty collections untouched %s', (raw) => {
  for (const key of ['writespace_posts', 'writespace_users']) if (raw !== null) localStorage.setItem(key, raw);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(['Total Posts', 'Total Users', 'Total Admins', 'Total users'].map(count)).toEqual(['0', '1', '1', '1']);
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
  expect(writes).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
  expect(localStorage.getItem('writespace_users')).toBe(raw);
});
it('falls back on denied collection reads without writing', () => {
  const get = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
    if (key !== 'writespace_session') throw new Error('denied');
    return get.call(this, key);
  });
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(count('Total Admins')).toBe('1');
  expect(count('Total Posts')).toBe('0');
  expect(writes).not.toHaveBeenCalled();
});
it('shows only newest five, retaining source order for ties and complete metadata', () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({ ...post,
    id: '87015eb3-4386-4870-a91e-3a1bdf51d00' + (index + 1), title: 'Post ' + index,
    createdAt: index < 2 ? '2026-03-09T12:00:00.000Z' : '2026-03-0' + (index + 1) + 'T12:00:00.000Z' }));
  const raw = JSON.stringify(rows);
  localStorage.setItem('writespace_posts', raw);
  mount();
  expect([...document.querySelectorAll('article h2')].map((node) => node.textContent)).toEqual(['Post 0', 'Post 1', 'Post 6', 'Post 5', 'Post 4']);
  expect(screen.getAllByRole('link', { name: 'Edit' })).toHaveLength(5);
  expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(5);
  for (const card of document.querySelectorAll('article')) {
    expect(within(card).getByText(post.content)).toBeInTheDocument();
    expect(within(card).getByText(post.authorName)).toBeInTheDocument();
    expect(card.querySelector('time')).not.toBeNull();
  }
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it.each([['Write a blog', '/write'], ['Manage users', '/users']])('quick action %s routes only on activation', (name, path) => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getByLabelText('Location').textContent).toBe('/admin');
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Quick actions' })).getByRole('link', { name }));
  expect(screen.getByLabelText('Location').textContent).toBe(path);
  expect(writes).not.toHaveBeenCalled();
});
it('renders zero as a legitimate statistic', () => {
  render(<dl><StatCard label="Total Posts" value={0} /></dl>);
  expect(count('Total Posts')).toBe('0');
});
it.each(['cancel', 'success', 'guest-before', 'user-before', 'guest-after', 'user-after', 'missing-before', 'missing-after', 'corrupt-before', 'corrupt-after', 'read-before', 'read-after', 'write'])('deletion branch %s preserves integrity and errors never redirect', (mode) => {
  localStorage.setItem('writespace_posts', JSON.stringify([post]));
  mount();
  const get = Storage.prototype.getItem;
  let confirmed = false;
  const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => {
    confirmed = true;
    if (mode === 'guest-after') localStorage.removeItem('writespace_session');
    if (mode === 'user-after') localStorage.setItem('writespace_session', JSON.stringify(user));
    if (mode === 'missing-after') localStorage.setItem('writespace_posts', '[]');
    if (mode === 'corrupt-after') localStorage.setItem('writespace_posts', '{bad');
    return mode !== 'cancel';
  });
  if (mode === 'guest-before') localStorage.removeItem('writespace_session');
  if (mode === 'user-before') localStorage.setItem('writespace_session', JSON.stringify(user));
  if (mode === 'missing-before') localStorage.setItem('writespace_posts', '[]');
  if (mode === 'corrupt-before') localStorage.setItem('writespace_posts', '{bad');
  if (mode.startsWith('read-')) vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
    if (key === 'writespace_posts' && (mode === 'read-before' || confirmed)) throw new Error('denied');
    return get.call(this, key);
  });
  const raw = get.call(localStorage, 'writespace_posts');
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  if (mode === 'write') writes.mockImplementation(() => { throw new Error('quota'); });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Other author' }));
  expect(screen.getByLabelText('Location').textContent).toBe(mode === 'success' ? '/blogs' : '/admin');
  if (mode === 'success') {
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0][0]).toBe('writespace_posts');
  } else if (mode === 'cancel') {
    expect(writes).not.toHaveBeenCalled();
    expect(get.call(localStorage, 'writespace_posts')).toBe(raw);
    expect(screen.queryByRole('alert')).toBeNull();
  } else {
    expect(screen.getByRole('alert')).toHaveTextContent(mode.includes('guest') || mode.includes('user') ? 'Administrator access' : mode.includes('missing') ? 'Post not found' : 'prevented deletion');
    if (mode !== 'write') expect(writes.mock.calls.filter(([key]) => key === 'writespace_posts' && !['missing-after', 'corrupt-after'].includes(mode))).toHaveLength(0);
  }
  if (mode.endsWith('before')) expect(confirm).not.toHaveBeenCalled();
});
it('deletes from fresh storage retaining newly added unrelated posts', () => {
  localStorage.setItem('writespace_posts', JSON.stringify([post]));
  mount();
  const added = { ...post, id: uid, title: 'Added later' };
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    localStorage.setItem('writespace_posts', JSON.stringify([post, added]));
    return true;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Other author' }));
  expect(JSON.parse(localStorage.getItem('writespace_posts'))).toEqual([added]);
});
it('latches nested and sequential deletion attempts', () => {
  localStorage.setItem('writespace_posts', JSON.stringify([post]));
  mount('/admin', <AdminDashboard session={admin} />);
  const button = screen.getByRole('button', { name: 'Delete Other author' });
  const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => { fireEvent.click(button); return true; });
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(writes).toHaveBeenCalledTimes(1);
});
it('admin edits a non-owned post through the existing editor preserving metadata', () => {
  localStorage.setItem('writespace_posts', JSON.stringify([post]));
  mount();
  fireEvent.click(screen.getByRole('link', { name: 'Edit' }));
  expect(screen.getByLabelText('Location').textContent).toBe('/edit/' + pid);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Admin revision' } });
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Revised\ntext' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(JSON.parse(localStorage.getItem('writespace_posts'))).toEqual([{ ...post, title: 'Admin revision', content: 'Revised\ntext' }]);
  expect(screen.getByLabelText('Location').textContent).toBe('/blog/' + pid);
});
