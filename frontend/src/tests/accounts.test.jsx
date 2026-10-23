/** Exercise account permissions, integrity, feedback and submission intent. */
import React from 'react';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import UserManagement from '../pages/UserManagement';
import { createAccount, deleteAccount, prepareAccountDeletion } from '../utils/storage';
const key = 'writespace_users';
const uid = '73f3aefa-c002-46af-a3ec-32252ed78001';
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const account = { id: uid, username: 'jane', displayName: 'Jane', password: 'secret-demo', role: 'admin', createdAt: '2026-03-04T12:00:00.000Z' };
const form = { displayName: 'Alex', username: 'alex', password: ' demo ', role: 'user' };
/** Mount the feature without hiding duplicate responsive controls in jsdom. */
function mount(element = <UserManagement session={admin} />) { return render(<MemoryRouter initialEntries={['/users']}>{element}</MemoryRouter>); }
/** Enter literal values through explicit field-change events. */
function fill(values = form) {
  for (const [name, label] of [['displayName', 'Display name'], ['username', 'Username'], ['password', 'Password'], ['role', 'Role']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: values[name] } });
  }
}
/** Submit through the public form event. */
function submit() { fireEvent.submit(screen.getByRole('form', { name: 'Create account' })); }
beforeEach(() => { localStorage.clear(); localStorage.setItem('writespace_session', JSON.stringify(admin)); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
it.each([null, '{bad', '{}', JSON.stringify({ ...admin, role: 'user' })])('guards route for %s', (raw) => {
  if (raw === null) localStorage.removeItem('writespace_session'); else localStorage.setItem('writespace_session', raw);
  mount(<App />);
  expect(screen.queryByRole('heading', { name: 'User Management' })).toBeNull();
});
it('lists metadata only, semantic headers, unknown default date and protected controls', () => {
  localStorage.setItem(key, JSON.stringify([account]));
  mount(<UserManagement session={{ ...admin, userId: uid }} />);
  expect(screen.getAllByRole('button', { name: 'Delete admin' }).every((button) => button.disabled && button.title === 'Default admin cannot be deleted.')).toBe(true);
  expect(screen.getAllByRole('button', { name: 'Delete jane' }).every((button) => button.disabled)).toBe(true);
  expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  expect(screen.getAllByText('Mar 04, 2026')).toHaveLength(2);
  expect(document.body.textContent).not.toContain(account.password);
  expect(screen.getAllByRole('columnheader').every((header) => header.getAttribute('scope') === 'col')).toBe(true);
});
it.each(['admin', 'user'])('creates exact %s account without session or posts writes', (role) => {
  const session = localStorage.getItem('writespace_session');
  localStorage.setItem('writespace_posts', 'sentinel');
  mount(); fill({ ...form, role }); submit();
  const [saved] = JSON.parse(localStorage.getItem(key));
  expect(saved).toEqual({ ...form, role, id: expect.stringMatching(/^[a-f0-9-]{36}$/), createdAt: expect.any(String) });
  expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
  expect(localStorage.getItem('writespace_session')).toBe(session);
  expect(localStorage.getItem('writespace_posts')).toBe('sentinel');
  expect(screen.getByRole('status')).toHaveTextContent('Account created.');
});
it.each(['displayName', 'username', 'password', 'role'])('rejects blank %s and retains dirty input', (field) => {
  mount(); fill({ ...form, [field]: field === 'role' ? '' : '   ' }); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('is required.');
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.getByLabelText('Password')).toHaveValue(field === 'password' ? '   ' : form.password);
});
it.each(['admin', 'jane'])('rejects reserved or duplicate username %s', (username) => {
  localStorage.setItem(key, JSON.stringify([account])); mount(); fill({ ...form, username }); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Username already exists.');
  expect(JSON.parse(localStorage.getItem(key))).toEqual([account]);
});
it('keeps uniqueness case-sensitive and rejects invalid or missing helper roles', () => {
  expect(() => createAccount({ ...form, role: 'owner' }, admin)).toThrow();
  expect(() => createAccount({ ...form, role: undefined }, admin)).toThrow();
  createAccount({ ...form, username: 'Admin' }, admin);
  expect(JSON.parse(localStorage.getItem(key))[0].username).toBe('Admin');
});
it.each(['{bad', '{}', 'null', '[{}]', JSON.stringify([account, account]), JSON.stringify([{ ...account, role: 'owner' }])])('strict corrupt creation read preserves %s', (raw) => {
  localStorage.setItem(key, raw); mount(); fill(); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('prevented account creation');
  expect(localStorage.getItem(key)).toBe(raw);
  expect(screen.getByLabelText('Username')).toHaveValue('alex');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
it.each(['read', 'write', 'session'])('denied %s retains form and allows later retry', (mode) => {
  mount(); fill();
  const method = mode === 'write' ? 'setItem' : 'getItem';
  const original = Storage.prototype[method];
  const spy = vi.spyOn(Storage.prototype, method).mockImplementation(function(k, value) {
    if (k === (mode === 'session' ? 'writespace_session' : key)) throw new Error('denied');
    return original.call(this, k, value);
  });
  submit(); expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toHaveValue(form.password);
  spy.mockRestore(); submit(); expect(JSON.parse(localStorage.getItem(key))).toHaveLength(1);
});
it.each([null, { ...admin, role: 'user' }])('rejects stale create actor %s', (actor) => {
  mount(); fill();
  if (actor) localStorage.setItem('writespace_session', JSON.stringify(actor)); else localStorage.removeItem('writespace_session');
  submit(); expect(localStorage.getItem(key)).toBeNull(); expect(screen.getByRole('alert')).toHaveTextContent('Administrator access');
});
it('blocks nested and sequential successful submits until explicit new intent', () => {
  mount(); fill(); const original = Storage.prototype.setItem;
  const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, value) {
    if (k === key) { submit(); fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ignored' } }); }
    return original.call(this, k, value);
  });
  act(() => { submit(); submit(); }); submit();
  expect(writes).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(key))[0].username).toBe('alex');
  fill({ ...form, username: 'newintent' }); submit();
  expect(JSON.parse(localStorage.getItem(key))).toHaveLength(2);
});
it.each(['cancel', 'success', 'guest-before', 'user-before', 'guest-after', 'user-after', 'self-after', 'missing-before', 'missing-after', 'corrupt-before', 'corrupt-after', 'read-before', 'read-after', 'write'])('delete branch %s never mutates posts or session', (mode) => {
  localStorage.setItem(key, JSON.stringify([account])); localStorage.setItem('writespace_posts', 'sentinel'); mount();
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  let confirmed = false;
  const set = (k, value) => originalSet.call(localStorage, k, value);
  const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => {
    confirmed = true;
    if (mode === 'guest-after') localStorage.removeItem('writespace_session');
    if (mode === 'user-after') set('writespace_session', JSON.stringify({ ...admin, role: 'user' }));
    if (mode === 'self-after') set('writespace_session', JSON.stringify({ ...admin, userId: uid }));
    if (mode === 'missing-after') set(key, '[]');
    if (mode === 'corrupt-after') set(key, '{bad');
    return mode !== 'cancel';
  });
  if (mode === 'guest-before') localStorage.removeItem('writespace_session');
  if (mode === 'user-before') set('writespace_session', JSON.stringify({ ...admin, role: 'user' }));
  if (mode === 'missing-before') set(key, '[]');
  if (mode === 'corrupt-before') set(key, '{bad');
  if (mode.startsWith('read-')) vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(k) {
    if (k === key && (mode === 'read-before' || confirmed)) throw new Error('denied');
    return originalGet.call(this, k);
  });
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  if (mode === 'write') writes.mockImplementation(() => { throw new Error('quota'); });
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete jane' })[0]);
  expect(originalGet.call(localStorage, 'writespace_posts')).toBe('sentinel');
  expect(writes.mock.calls.every(([k]) => k === key)).toBe(true);
  if (mode === 'success') { expect(localStorage.getItem(key)).toBe('[]'); expect(screen.getByRole('status')).toHaveTextContent('Account deleted.'); }
  else if (mode === 'cancel') { expect(writes).not.toHaveBeenCalled(); expect(screen.queryByRole('alert')).toBeNull(); }
  else { expect(screen.getByRole('alert')).toBeInTheDocument(); expect(screen.getByRole('status')).toBeEmptyDOMElement(); if (mode !== 'write') expect(writes).not.toHaveBeenCalled(); }
  if (mode.endsWith('before')) expect(confirm).not.toHaveBeenCalled();
});
it('rejects default/self in handlers, including after confirmation, and missing targets', () => {
  expect(() => prepareAccountDeletion('admin', admin)).toThrow('Default admin cannot be deleted.');
  expect(() => deleteAccount(uid, { ...admin, userId: uid })).toThrow('Your current account');
  expect(() => deleteAccount('admin', admin)).toThrow('Default admin');
  expect(() => deleteAccount(uid, admin)).toThrow('Account not found');
});
it('fresh deletion retains accounts added during confirmation and blocks nested attempts', () => {
  localStorage.setItem(key, JSON.stringify([account])); mount();
  const button = screen.getAllByRole('button', { name: 'Delete jane' })[0];
  const added = { ...account, id: '87015eb3-4386-4870-a91e-3a1bdf51d001', username: 'added' };
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    fireEvent.click(button); localStorage.setItem(key, JSON.stringify([account, added])); return true;
  });
  fireEvent.click(button); expect(JSON.parse(localStorage.getItem(key))).toEqual([added]);
});
