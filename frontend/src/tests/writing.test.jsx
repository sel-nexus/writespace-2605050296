/** Verify owned writing against real browser-local records. */
import React from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import App from '../App';
import WriteBlog from '../pages/WriteBlog';
import { BlogCard } from '../components/BlogCard';
import { canModify, excerpt, formatDate } from '../utils/storage';
const uid = '73f3aefa-c002-46af-a3ec-32252ed78001';
const pid = '87015eb3-4386-4870-a91e-3a1bdf51d001';
const actor = { userId: uid, username: 'jane', displayName: 'Jane', role: 'user' };
const post = { id: pid, title: 'First', content: 'Hello\n<script>alert(1)</script>',
  createdAt: '2026-03-04T12:00:00.000Z', authorId: uid, authorName: 'Original Jane' };
/** Expose observable routing. */
function Location() { return <output aria-label="Location">{useLocation().pathname}</output>; }
/** Mount real route composition. */
function mount(path = '/blogs', element = <App />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {element}
      <Location />
    </MemoryRouter>
  );
}
/** Fill a writing form without per-character large-payload overhead. */
function fill(title = 'New title', content = 'New\ncontent') {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: content } });
  return screen.getByRole('button', { name: 'Save' }).closest('form');
}
beforeEach(() => { localStorage.clear(); localStorage.setItem('writespace_session', JSON.stringify(actor)); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
it('formats literal 120 character boundaries and permissions', () => {
  expect(excerpt('x'.repeat(121))).toBe('x'.repeat(120));
  expect(excerpt('x'.repeat(120))).toHaveLength(120);
  expect(excerpt('short')).toBe('short');
  expect(formatDate(post.createdAt)).toBe('Mar 04, 2026');
  expect(canModify(null, post)).toBe(false);
  expect(canModify(actor, post)).toBe(true);
  expect(canModify({ ...actor, userId: 'admin', role: 'admin' }, post)).toBe(true);
  expect(canModify({ ...actor, userId: pid }, post)).toBe(false);
});
it('lists newest first with stable ties, excerpts and owner-only controls without writes', () => {
  const rows = [post, { ...post, id: uid, title: 'Latest', createdAt: '2026-03-05T12:00:00.000Z', authorId: 'admin' },
    { ...post, id: '87015eb3-4386-4870-a91e-3a1bdf51d002', title: 'Tie' }];
  localStorage.setItem('writespace_posts', JSON.stringify(rows));
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Latest', 'First', 'Tie']);
  expect(screen.getAllByRole('link', { name: 'Edit' })).toHaveLength(2);
  expect(writes).not.toHaveBeenCalled();
  expect(document.querySelector('.grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
});
it.each([null, '{bad', '{}', '[{}]'])('shows exact empty fallback without repair: %s', (raw) => {
  if (raw !== null) localStorage.setItem('writespace_posts', raw);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeInTheDocument();
  expect(writes).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it.each(['/blogs', '/write', '/blog/' + pid, '/edit/' + pid])('guards guest %s', (path) => {
  localStorage.removeItem('writespace_session'); mount(path);
  expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
});
it.each(['/blog/' + pid, '/edit/' + pid])('shows exact missing state %s', (path) => {
  mount(path); expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
});
it('reads multiline XSS as text and has no action on render', () => {
  localStorage.setItem('writespace_posts', JSON.stringify([post]));
  const confirm = vi.spyOn(window, 'confirm'); mount('/blog/' + pid);
  const body = screen.getByText((text, element) => element.tagName === 'P' && element.textContent === post.content);
  expect(body.textContent).toBe(post.content);
  expect(body).toHaveClass('whitespace-pre-wrap');
  expect(document.querySelector('script')).toBeNull(); expect(confirm).not.toHaveBeenCalled();
});
it('creates exact metadata, retains large text, and re-reads author session', () => {
  mount('/write'); const content = 'x'.repeat(2 * 1024 * 1024) + '\nend'; const form = fill(' Title ', content);
  const current = { ...actor, displayName: 'Current name' };
  localStorage.setItem('writespace_session', JSON.stringify(current));
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(pid);
  fireEvent.submit(form);
  const saved = JSON.parse(localStorage.getItem('writespace_posts'))[0];
  expect(saved).toEqual({ id: pid, title: ' Title ', content, authorId: uid, authorName: 'Current name', createdAt: saved.createdAt });
  expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
  expect(screen.getByLabelText('Location')).toHaveTextContent('/blog/' + pid);
});
it('edits only text using freshly read metadata', () => {
  localStorage.setItem('writespace_posts', JSON.stringify([post])); mount('/edit/' + pid);
  expect(screen.getByLabelText('Content')).toHaveValue(post.content);
  const changed = { ...post, authorName: 'Fresh snapshot', createdAt: '2025-01-01T12:00:00.000Z' };
  localStorage.setItem('writespace_posts', JSON.stringify([changed])); fireEvent.submit(fill());
  expect(JSON.parse(localStorage.getItem('writespace_posts'))).toEqual([{ ...changed, title: 'New title', content: 'New\ncontent' }]);
});
it.each(['Title', 'Content'])('rejects blank %s without writes', (label) => {
  mount('/write'); const form = fill(); fireEvent.change(screen.getByLabelText(label), { target: { value: '  ' } });
  const writes = vi.spyOn(Storage.prototype, 'setItem'); fireEvent.submit(form);
  expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true'); expect(writes).not.toHaveBeenCalled();
});
it.each(['{bad', '{}', '[{}]', JSON.stringify([post, post])])('strictly denies corrupt save %s', (raw) => {
  mount('/write'); localStorage.setItem('writespace_posts', raw);
  const writes = vi.spyOn(Storage.prototype, 'setItem'); fireEvent.submit(fill());
  expect(screen.getByRole('alert')).toHaveTextContent('retained'); expect(writes).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_posts')).toBe(raw); expect(screen.getByLabelText('Content')).toHaveValue('New\ncontent');
});
it('retains dirty input on denied read and failed write, allowing explicit retry', () => {
  mount('/write'); const form = fill();
  const get = Storage.prototype.getItem;
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(key) {
    if (key === 'writespace_posts') throw new Error('denied'); return get.call(this, key);
  });
  fireEvent.submit(form); expect(screen.getByRole('alert')).toHaveTextContent('retained'); read.mockRestore();
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  fireEvent.submit(form); expect(screen.getByLabelText('Location')).toHaveTextContent('/write');
  expect(screen.getByLabelText('Title')).toHaveValue('New title'); write.mockRestore();
  fireEvent.submit(form); expect(JSON.parse(localStorage.getItem('writespace_posts'))).toHaveLength(1);
});
it.each(['sequential', 'nested'])('latches %s submit before React commit', (mode) => {
  mount('/write', <WriteBlog session={actor} />); const form = fill();
  const set = Storage.prototype.setItem;
  const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue(pid);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
    if (mode === 'nested') fireEvent.submit(form); set.call(this, key, value);
  });
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(uuid).toHaveBeenCalledTimes(1); expect(JSON.parse(localStorage.getItem('writespace_posts'))).toHaveLength(1);
});
it.each(['guest', 'owner changed', 'missing'])('rechecks save target/actor: %s', (mode) => {
  localStorage.setItem('writespace_posts', JSON.stringify([post])); mount('/edit/' + pid); const form = fill();
  if (mode === 'guest') localStorage.removeItem('writespace_session');
  else localStorage.setItem('writespace_posts', JSON.stringify(mode === 'missing' ? [] : [{ ...post, authorId: 'admin' }]));
  const writes = vi.spyOn(Storage.prototype, 'setItem'); fireEvent.submit(form); expect(writes).not.toHaveBeenCalled();
  if (mode === 'missing') expect(screen.getByText('Post not found')).toBeInTheDocument();
  else expect(screen.getByLabelText('Location')).toHaveTextContent(mode === 'guest' ? '/login' : '/blogs');
});
it('denies non-owner edit and hides reader mutations', () => {
  localStorage.setItem('writespace_posts', JSON.stringify([{ ...post, authorId: 'admin' }]));
  const view = mount('/edit/' + pid); expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs'); view.unmount();
  mount('/blog/' + pid); expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
});
it.each(['/write', '/edit/' + pid])('cancel leaves bytes untouched %s', async (path) => {
  const raw = JSON.stringify([post]); localStorage.setItem('writespace_posts', raw); mount(path); fill();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Cancel' }));
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
  expect(screen.getByLabelText('Location')).toHaveTextContent(path === '/write' ? '/blogs' : '/blog/' + pid);
});
it.each(['cancel', 'success', 'actor', 'target', 'missing', 'corrupt', 'quota'])('confirmed deletion branch %s', async (mode) => {
  localStorage.setItem('writespace_posts', JSON.stringify([post])); mount('/blog/' + pid);
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (mode === 'actor') localStorage.setItem('writespace_session', JSON.stringify({ ...actor, userId: pid }));
    if (mode === 'target') localStorage.setItem('writespace_posts', JSON.stringify([{ ...post, authorId: 'admin' }]));
    if (mode === 'missing') localStorage.setItem('writespace_posts', '[]');
    if (mode === 'corrupt') localStorage.setItem('writespace_posts', '{bad');
    return mode !== 'cancel';
  });
  if (mode === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  if (mode === 'success') expect(localStorage.getItem('writespace_posts')).toBe('[]');
  else if (mode === 'missing') expect(screen.getByText('Post not found')).toBeInTheDocument();
  else if (['corrupt', 'quota'].includes(mode)) expect(screen.getByRole('alert')).toHaveTextContent('prevented deletion');
  else expect(JSON.parse(localStorage.getItem('writespace_posts'))).toHaveLength(1);
});
it('resolves stored-admin avatar and invokes explicit card edit only on click', async () => {
  const edit = vi.fn(); mount('/blogs', <BlogCard post={post} session={actor} index={5} users={[{ id: uid, role: 'admin' }]} onEdit={edit} />);
  expect(screen.getByText('admin')).toBeInTheDocument(); expect(edit).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit' })); expect(edit).toHaveBeenCalledWith(pid);
});
it('toggles mobile/account navigation and logs out only after successful remove', async () => {
  mount(); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByRole('link', { name: 'Write', exact: true }));
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: /Jane user/ }));
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(screen.getByRole('alert')).toHaveTextContent('still signed in'); expect(localStorage.getItem('writespace_session')).not.toBeNull();
  remove.mockRestore(); await user.click(screen.getByRole('button', { name: /Jane user/ }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(localStorage.getItem('writespace_session')).toBeNull(); expect(screen.getByLabelText('Location').textContent).toBe('/');
});
