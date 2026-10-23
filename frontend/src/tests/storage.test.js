/** Exercise actual storage helpers against browser storage and boundary failures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers, readArrayForMutation } from '../utils/storage.js';
import { getSession, setSession, clearSession } from '../utils/auth.js';

const post = {
  id: '87015eb3-4386-4870-a91e-3a1bdf51d001', title: ' First notes ',
  content: 'Hello\nWriteSpace <script>alert(1)</script>',
  createdAt: '2026-03-04T12:00:00.000Z', authorId: 'admin', authorName: 'Admin',
};
const user = {
  id: '73f3aefa-c002-46af-a3ec-32252ed78001', displayName: ' Jane Doe ',
  username: 'janedoe', password: ' demo-only\n ', role: 'user',
  createdAt: '2026-03-04T12:00:00.000Z',
};
const session = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const collections = [
  ['posts', 'writespace_posts', post, getPosts, savePosts],
  ['users', 'writespace_users', user, getUsers, saveUsers],
];

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe.each(collections)('%s integrity', (_name, key, record, read, save) => {
  it('distinguishes absent data from corruption and persists exact arrays', () => {
    expect(read()).toEqual([]);
    expect(readArrayForMutation(key)).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();
    const input = [structuredClone(record)];
    const before = structuredClone(input);
    expect(save(input)).toBeUndefined();
    expect(localStorage.getItem(key)).toBe(JSON.stringify(input));
    expect(read()).toEqual(input);
    expect(readArrayForMutation(key)).toEqual(input);
    expect(input).toEqual(before);
    const snapshot = read();
    snapshot[0].id = 'changed';
    expect(read()).toEqual(input);
    expect(save([])).toBeUndefined();
    expect(localStorage.getItem(key)).toBe('[]');
  });

  it.each(['', '{broken', 'null', '{}', '1', '"text"', 'true', '[null]', '[[]]'])
    ('preserves invalid raw bytes %j on display and strict reads', (raw) => {
      localStorage.setItem(key, raw);
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      expect(read()).toEqual([]);
      expect(() => readArrayForMutation(key)).toThrow();
      expect(writes).not.toHaveBeenCalled();
      expect(localStorage.getItem(key)).toBe(raw);
    });

  const invalid = [null, {}, [], 1, 'text', true];
  for (const field of Object.keys(record)) {
    const missing = { ...record };
    delete missing[field];
    invalid.push(missing);
    for (const value of [undefined, null, 1, false, {}, [], '', ' \n\t ']) {
      invalid.push({ ...record, [field]: value });
    }
  }
  invalid.push({ ...record, extra: 'future schema' }, { ...record, id: 'admin' },
    { ...record, id: 'not-uuid' });
  for (const createdAt of ['yesterday', '2026-03-04', '123', '2026-99-04T12:00:00Z', '2026-03-04T99:00:00Z']) {
    invalid.push({ ...record, createdAt });
  }
  if (key === 'writespace_posts') invalid.push({ ...record, authorId: 'missing' });
  else invalid.push({ ...record, role: 'owner' }, { ...record, role: 'USER' }, { ...record, username: 'admin' });

  it.each(invalid.map((bad, index) => [index, bad]))
    ('rejects invalid member #%i without partial reads or destructive writes', (_index, bad) => {
      const raw = JSON.stringify([record, bad]);
      localStorage.setItem(key, raw);
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      expect(read()).toEqual([]);
      expect(() => readArrayForMutation(key)).toThrow();
      expect(() => save([bad])).toThrow();
      expect(writes).not.toHaveBeenCalled();
      expect(localStorage.getItem(key)).toBe(raw);
    });

  it.each([null, {}, '[]', 0, undefined])('rejects non-array save %j', (bad) => {
    save([record]);
    const raw = localStorage.getItem(key);
    expect(() => save(bad)).toThrow();
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('rejects duplicate IDs including alternate hex case', () => {
    const input = [record, { ...record, id: record.id.toUpperCase() }];
    const raw = JSON.stringify(input);
    localStorage.setItem(key, raw);
    expect(read()).toEqual([]);
    expect(() => readArrayForMutation(key)).toThrow();
    expect(() => save(input)).toThrow();
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it.each(['SecurityError', 'QuotaExceededError'])('propagates %s writes while preserving old bytes', (name) => {
    save([record]);
    const raw = localStorage.getItem(key);
    const error = new DOMException('Denied', name);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw error; });
    expect(() => save([])).toThrow(expect.objectContaining({ name: error.name, message: error.message }));
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('returns fallback on denied reads but strict reads throw without writing', () => {
    save([record]);
    const raw = localStorage.getItem(key);
    const error = new DOMException('Denied', 'SecurityError');
    const reads = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw error; });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(read()).toEqual([]);
    expect(() => readArrayForMutation(key)).toThrow(expect.objectContaining({ name: error.name, message: error.message }));
    expect(writes).not.toHaveBeenCalled();
    reads.mockRestore();
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('propagates serialization failure without replacing old bytes', () => {
    save([record]);
    const raw = localStorage.getItem(key);
    const error = new TypeError('Serialization failed');
    vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw error; });
    expect(() => save([record])).toThrow(expect.objectContaining({ name: error.name, message: error.message }));
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it.each([10, 100, 1000])('roundtrips %i complete records with no filtering or truncation', (count) => {
    const input = Array.from({ length: count }, (_, index) => ({
      ...record, id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      ...(key === 'writespace_users' ? { username: `name-${index}` } : {}),
    }));
    save(input);
    expect(read()).toEqual(input);
    expect(readArrayForMutation(key)).toEqual(input);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(input));
  });
});

it('accepts orphan UUID authors, offset timestamps, exact case usernames and stored admins', () => {
  const input = [{ ...post, authorId: user.id, createdAt: '2026-03-04T12:00:00+01:00' }];
  savePosts(input);
  expect(getPosts()).toEqual(input);
  const users = [user, { ...user, id: post.id, username: 'Admin', role: 'admin' }];
  saveUsers(users);
  expect(getUsers()).toEqual(users);
});

it('rejects duplicate usernames even when IDs differ and preserves original bytes', () => {
  const input = [user, { ...user, id: post.id }];
  const raw = JSON.stringify(input);
  localStorage.setItem('writespace_users', raw);
  expect(getUsers()).toEqual([]);
  expect(() => readArrayForMutation('writespace_users')).toThrow();
  expect(() => saveUsers(input)).toThrow();
  expect(localStorage.getItem('writespace_users')).toBe(raw);
});

it('roundtrips about two MiB of literal multiline content', () => {
  const input = [{ ...post, content: 'Text\n'.repeat(420000) }];
  savePosts(input);
  expect(getPosts()).toEqual(input);
  expect(localStorage.getItem('writespace_posts')).toBe(JSON.stringify(input));
});

it.each(['unknown', 'writespace_session', null, undefined])('rejects unsupported mutation key %j without storage access', (key) => {
  const reads = vi.spyOn(Storage.prototype, 'getItem');
  expect(() => readArrayForMutation(key)).toThrow();
  expect(reads).not.toHaveBeenCalled();
});

describe('session integrity', () => {
  it('roundtrips default, stored user, and stored admin sessions exactly', () => {
    expect(getSession()).toBeNull();
    for (const input of [session, { userId: user.id, username: user.username, displayName: user.displayName, role: 'user' },
      { userId: user.id, username: 'otherAdmin', displayName: 'Other Admin', role: 'admin' }]) {
      expect(setSession(input)).toBeUndefined();
      expect(getSession()).toEqual(input);
      expect(localStorage.getItem('writespace_session')).toBe(JSON.stringify(input));
    }
  });

  const invalid = [null, [], {}, 1, true, 'text', { ...session, password: 'admin' },
    { ...session, userId: 'invalid' }, { ...session, role: 'owner' }];
  for (const field of Object.keys(session)) {
    const missing = { ...session };
    delete missing[field];
    invalid.push(missing);
    for (const value of [undefined, null, 1, false, [], {}, '', ' \t\n ']) invalid.push({ ...session, [field]: value });
  }
  it.each(invalid.map((bad, index) => [index, bad]))('fails closed for invalid session #%i and rejects writes', (_index, bad) => {
    const raw = JSON.stringify(bad);
    localStorage.setItem('writespace_session', raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(getSession()).toBeNull();
    expect(() => setSession(bad)).toThrow();
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });

  it.each(['', '{broken', 'undefined'])('preserves malformed JSON %j', (raw) => {
    localStorage.setItem('writespace_session', raw);
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });

  it('fails closed on denied reads without writing or removing', () => {
    setSession(session);
    const raw = localStorage.getItem('writespace_session');
    const reads = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removes = vi.spyOn(Storage.prototype, 'removeItem');
    expect(getSession()).toBeNull();
    expect(writes).not.toHaveBeenCalled();
    expect(removes).not.toHaveBeenCalled();
    reads.mockRestore();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });

  it.each(['SecurityError', 'QuotaExceededError'])('propagates %s session write failure', (name) => {
    setSession(session);
    const raw = localStorage.getItem('writespace_session');
    const error = new DOMException('Denied', name);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw error; });
    expect(() => setSession({ ...session, displayName: 'Changed' })).toThrow(expect.objectContaining({ name: error.name, message: error.message }));
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });

  it('propagates session serialization failure with unchanged bytes', () => {
    setSession(session);
    const raw = localStorage.getItem('writespace_session');
    vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('Cannot serialize'); });
    expect(() => setSession(session)).toThrow('Cannot serialize');
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });

  it('clears only the session and is idempotent', () => {
    savePosts([post]); saveUsers([user]); setSession(session);
    expect(clearSession()).toBeUndefined();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(clearSession()).toBeUndefined();
    expect(getPosts()).toEqual([post]);
    expect(getUsers()).toEqual([user]);
  });

  it('propagates denied removal and retains all stored bytes', () => {
    savePosts([post]); saveUsers([user]); setSession(session);
    const error = new DOMException('Denied', 'SecurityError');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw error; });
    expect(() => clearSession()).toThrow(expect.objectContaining({ name: error.name, message: error.message }));
    expect(getSession()).toEqual(session);
    expect(getPosts()).toEqual([post]);
    expect(getUsers()).toEqual([user]);
  });
});
