/** Manage eligible browser-local accounts without changing active identity. */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getSession } from '../utils/auth';
import { createAccount, deleteAccount, prepareAccountDeletion, readArrayForMutation, requireAccountAdmin } from '../utils/storage';
import { UserRow } from '../components/UserRow';

const emptyForm = { displayName: '', username: '', password: '', role: '' };
const fields = [['displayName', 'Display name'], ['username', 'Username'], ['password', 'Password'], ['role', 'Role']];
const defaultAdmin = { id: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };

/** Render validated creation and confirmed, freshly authorized deletion.
 * Args:
 *   session: Snapshot used only for display and disabled controls.
 * Returns:
 *   Account form, inline feedback and responsive metadata list.
 */
export default function UserManagement({ session }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gate] = useState(() => ({ busy: false, consumed: false }));
  const [deleteGate] = useState(() => ({ busy: false }));
  useEffect(() => {
    try { setUsers(readArrayForMutation('writespace_users')); }
    catch { setNotice('Browser storage prevented loading accounts. Existing data was not changed.'); }
  }, []);

  /** Reset the successful-intent latch only on an explicit field change. */
  function changeField(name, value) {
    if (gate.busy) return;
    gate.consumed = false;
    setForm((current) => ({ ...current, [name]: value }));
    setSuccess('');
  }
  /** Consume a successful write synchronously before any React state update. */
  function handleCreate(event) {
    event.preventDefault();
    if (gate.busy || gate.consumed) return;
    gate.busy = true;
    setSubmitting(true);
    setSuccess('');
    setNotice('');
    try {
      const actor = getSession();
      requireAccountAdmin(actor);
      const invalid = {};
      fields.forEach(([name, label]) => {
        if (!form[name].trim()) invalid[name] = label + ' is required.';
      });
      if (form.role && !['admin', 'user'].includes(form.role)) invalid.role = 'Choose admin or user.';
      setErrors(invalid);
      if (Object.keys(invalid).length) return;
      const next = createAccount(form, getSession());
      gate.consumed = true;
      setUsers(next);
      setForm({ ...emptyForm });
      setSuccess('Account created.');
    } catch (error) {
      setNotice(error.message === 'Username already exists.' || error.message === 'Administrator access is required.'
        ? error.message : 'Browser storage prevented account creation. Your input was retained.');
    } finally {
      gate.busy = false;
      setSubmitting(false);
    }
  }
  /** Recheck both actor and target after the blocking confirmation returns. */
  function handleDelete(id) {
    if (deleteGate.busy) return;
    deleteGate.busy = true;
    setSuccess('');
    setNotice('');
    try {
      prepareAccountDeletion(id, getSession());
      if (!window.confirm('Delete this account? This cannot be undone.')) return;
      const next = deleteAccount(id, getSession());
      setUsers(next);
      setSuccess('Account deleted.');
    } catch (error) {
      const known = ['Administrator access is required.', 'Default admin cannot be deleted.', 'Your current account cannot be deleted.', 'Account not found.'];
      setNotice(known.includes(error.message) ? error.message : 'Browser storage prevented account deletion. Existing data was not changed.');
    } finally { deleteGate.busy = false; }
  }
  const listed = [defaultAdmin, ...users];
  return (
    <section aria-labelledby="users-title">
      <h1 id="users-title" className="text-3xl font-semibold">User Management</h1>
      <p className="mt-3 text-slate-600">Create demo accounts and remove eligible accounts.</p>
      <form onSubmit={handleCreate} noValidate aria-label="Create account" aria-busy={submitting}
        className="my-8 grid gap-6 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
        {fields.map(([name, label]) => (
          <div key={name}>
            <label htmlFor={'account-' + name} className="mb-2 block text-sm font-medium">{label}</label>
            {name === 'role' ? (
              <select id={'account-' + name} value={form.role} required aria-required="true"
                aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + '-error' : undefined}
                onChange={(event) => changeField(name, event.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500">
                <option value="">Choose a role</option>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            ) : (
              <input id={'account-' + name} value={form[name]} type={name === 'password' ? 'password' : 'text'}
                autoComplete={name === 'password' ? 'new-password' : 'off'} required aria-required="true"
                aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + '-error' : undefined}
                onChange={(event) => changeField(name, event.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500" />
            )}
            {errors[name] && (
              <p id={name + '-error'} role="alert" className="mt-2 text-sm text-red-700">{errors[name]}</p>
            )}
          </div>
        ))}
        <button type="submit" disabled={submitting} className="justify-self-start rounded-lg bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      {notice && (
        <p role="alert" className="mb-6 text-sm text-red-700">{notice}</p>
      )}
      <p role="status" className="mb-6 text-sm text-slate-700">{success}</p>
      <div className="space-y-4 sm:hidden" aria-label="Account cards">
        {listed.map((user) => (
          <UserRow key={user.id} user={user} session={session} onDelete={handleDelete} isDefault={user.id === 'admin'} mobile />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <table className="w-full text-left" aria-label="Accounts">
          <thead className="text-sm text-slate-600">
            <tr>
              {['Display name', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                <th key={label} scope="col" className="p-4 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listed.map((user) => (
              <UserRow key={user.id} user={user} session={session} onDelete={handleDelete} isDefault={user.id === 'admin'} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
UserManagement.propTypes = { session: PropTypes.object.isRequired };
