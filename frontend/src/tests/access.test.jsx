/** Exercise access behavior using real storage and restored failure fixtures. */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '../App';
import LoginPage from '../pages/LoginPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Avatar } from '../components/Avatar';
import { getSession } from '../utils/auth';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const account = { id: '73f3aefa-c002-46af-a3ec-32252ed78001', username: 'jane',
  displayName: 'Jane', password: ' demo ', role: 'user', createdAt: '2026-03-04T12:00:00.000Z' };
const user = { userId: account.id, username: account.username, displayName: account.displayName, role: 'user' };
/** Expose route outcomes without depending on router internals. */
function Location() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}
/** Mount the login form without unmounting it on success to exercise replay rejection. */
function login(session = null, callback = vi.fn()) {
  const result = render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage session={session} onSessionChange={callback} />
      <Location />
    </MemoryRouter>,
  );
  return { ...result, callback };
}
/** Enter exact credential bytes and return the submit form. */
function credentials(username = 'admin', password = 'admin') {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  return screen.getByRole('button', { name: 'Sign in' }).closest('form');
}
/** Mount real application routes with an optional persisted identity. */
function application(path, session) {
  if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe('login persistence and input contracts', () => {
  it('logs in default admin before reading corrupt accounts and persists exact identity', () => {
    localStorage.setItem('writespace_users', '{broken');
    const { callback } = login();
    fireEvent.submit(credentials());
    expect(getSession()).toEqual(admin);
    expect(callback).toHaveBeenCalledWith(admin);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/admin');
    expect(localStorage.getItem('writespace_users')).toBe('{broken');
  });
  it.each(['user', 'admin'])('logs in stored %s using exact password bytes', (role) => {
    localStorage.setItem('writespace_users', JSON.stringify([{ ...account, role }]));
    login();
    fireEvent.submit(credentials('jane', ' demo '));
    expect(getSession()).toEqual({ ...user, role });
    expect(screen.getByLabelText('Location')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
  });
  it.each([['admin', 'wrong'], ['Admin', 'admin'], ['unknown', 'demo'], ['', 'admin'],
    ['admin', ''], ['   ', 'admin'], ['admin', '   '], ['jane', 'demo']])(
    'rejects invalid or blank credentials %j / %j without writes', (name, password) => {
      localStorage.setItem('writespace_users', JSON.stringify([account]));
      const { callback } = login();
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      fireEvent.submit(credentials(name, password));
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
      expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
      expect(getSession()).toBeNull();
      expect(writes).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Password')).toHaveValue(password);
      expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    },
  );
  it.each(['{broken', '{}', '[{}]', JSON.stringify([{ ...account, role: 'root' }])])(
    'distinguishes corrupt credential storage from invalid credentials: %s', (raw) => {
      localStorage.setItem('writespace_users', raw);
      login();
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      fireEvent.submit(credentials('jane', ' demo '));
      expect(screen.getByRole('alert')).toHaveTextContent('Browser storage');
      expect(screen.getByRole('alert')).not.toHaveTextContent('Invalid username or password.');
      expect(localStorage.getItem('writespace_users')).toBe(raw);
      expect(writes).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    },
  );
  it('handles denied credential reads without session callback or navigation', () => {
    const { callback } = login();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    fireEvent.submit(credentials('jane', ' demo '));
    expect(screen.getByRole('alert')).toHaveTextContent('Browser storage');
    expect(callback).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
  });
  it('retains inputs after denied session writes and permits explicit retry', () => {
    const { callback } = login();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const form = credentials();
    fireEvent.submit(form);
    expect(getSession()).toBeNull();
    expect(callback).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('admin');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    write.mockRestore();
    fireEvent.submit(form);
    expect(getSession()).toEqual(admin);
  });
  it('blocks nested busy and sequential consumed submissions before React commits', () => {
    const { callback } = login();
    const form = credentials();
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      fireEvent.submit(form);
      return original.call(this, key, value);
    });
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(getSession()).toEqual(admin);
  });
  it('recovers from validation failure when the user edits inputs', () => {
    login();
    fireEvent.submit(credentials('admin', 'wrong'));
    fireEvent.submit(credentials());
    expect(getSession()).toEqual(admin);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each([admin, user])('redirects signed-in login without writes for $role', (session) => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    login(session);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toHaveTextContent(session.role === 'admin' ? '/admin' : '/blogs');
    expect(writes).not.toHaveBeenCalled();
  });
  it('shows honest disclosure and accessible required password input', () => {
    login();
    expect(screen.getByText(/Credentials are stored in plaintext/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-required', 'true');
  });
});

describe('guards and application session lifecycle', () => {
  it.each(['/blogs', '/blog/unknown', '/write', '/edit/unknown', '/admin', '/users'])(
    'redirects guest deep route %s to login', (path) => {
      application(path);
      expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    },
  );
  it.each(['/admin', '/users'])('redirects ordinary users from %s to blogs', (path) => {
    application(path, user);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
    expect(screen.getByRole('heading', { name: 'Writing workspace' })).toBeInTheDocument();
  });
  it.each([admin, user])('allows persisted $role on blogs without mount writes', (session) => {
    localStorage.setItem('writespace_session', JSON.stringify(session));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    application('/blogs');
    expect(screen.getByText(session.displayName, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/no content tools yet/)).toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
  });
  it.each(['{broken', '{}', JSON.stringify({ ...admin, role: 'root' })])('fails closed on malformed session %s', (raw) => {
    localStorage.setItem('writespace_session', raw);
    application('/admin');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });
  it('fails closed when startup session storage is denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    application('/admin');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
  });
  it('rechecks persistent identity even when protected children are supplied', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<ProtectedRoute role="admin"><p>Secret</p></ProtectedRoute>} />
          <Route path="/login" element={<p>Guest destination</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.getByText('Guest destination')).toBeInTheDocument();
  });
  it('logs in through App then logs out only the session and returns to entry', () => {
    localStorage.setItem('writespace_users', '[]');
    localStorage.setItem('writespace_posts', '[]');
    application('/');
    fireEvent.submit(credentials());
    expect(screen.getByText('Admin', { selector: 'span' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'All Blogs' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/blogs');
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_users')).toBe('[]');
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
  });
  it('does not claim logout on removal failure and permits explicit retry', () => {
    application('/admin', admin);
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('You are still signed in');
    expect(getSession()).toEqual(admin);
    expect(screen.getByLabelText('Location')).toHaveTextContent('/admin');
    remove.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
  });
  it('offers a back-home link for unknown routes', () => {
    application('/missing');
    expect(screen.getByRole('heading')).toHaveTextContent('Page not found');
    fireEvent.click(screen.getByRole('link', { name: 'Back home' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent('/login');
  });
  it.each(['admin', 'user'])('renders a decorative static SVG for %s', (role) => {
    const { container } = render(<Avatar role={role} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('path').getAttribute('d')).toContain(role === 'admin' ? 'L3 6' : 'V4z');
  });
});
