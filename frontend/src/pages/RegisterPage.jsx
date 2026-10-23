/** Create user-only demo accounts without replaying partial registration. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { readArrayForMutation, saveUsers } from '../utils/storage';
import { setSession } from '../utils/auth';
import { PublicNavbar } from '../components/PublicNavbar';

const fields = [['displayName', 'Display name'], ['username', 'Username'],
  ['password', 'Password'], ['confirmPassword', 'Confirm password']];

/** Persist an account before its session and retain dirty input on failure.
 * Args:
 *   session: Existing identity, redirected to its role home.
 *   onSessionChange: Callback invoked only after session persistence.
 * Returns:
 *   An accessible registration form or signed-in redirect.
 */
export default function RegisterPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [partial, setPartial] = useState(false);
  const [gate] = useState(() => ({ busy: false, consumed: false }));

  /** Latch before validation and consume immediately after the first successful write. */
  function handleRegister(event) {
    event.preventDefault();
    if (gate.busy || gate.consumed) return;
    gate.busy = true;
    setSubmitting(true);
    setNotice('');
    try {
      const invalid = {};
      fields.forEach(([name, label]) => { if (!form[name].trim()) invalid[name] = label + ' is required.'; });
      if (!invalid.confirmPassword && form.password !== form.confirmPassword) invalid.confirmPassword = 'Passwords must match.';
      if (Object.keys(invalid).length) { setErrors(invalid); return; }
      const users = readArrayForMutation('writespace_users');
      if (form.username === 'admin' || users.some((user) => user.username === form.username)) {
        setErrors({ username: 'Username already exists.' });
        return;
      }
      setErrors({});
      const user = { id: crypto.randomUUID(), displayName: form.displayName, username: form.username,
        password: form.password, role: 'user', createdAt: new Date().toISOString() };
      saveUsers([...users, user]);
      gate.consumed = true;
      const next = { userId: user.id, username: user.username, displayName: user.displayName, role: 'user' };
      setSession(next);
      onSessionChange(next);
      navigate('/blogs', { replace: true });
    } catch {
      if (gate.consumed) {
        setPartial(true);
        setNotice('Your account was saved, but sign-in was not completed. Use Login; do not register again.');
      } else {
        setNotice('Browser storage is unavailable or contains invalid data. Your account was not saved. Please try again.');
      }
    } finally {
      gate.busy = false;
      setSubmitting(false);
    }
  }

  if (session) return <Navigate to={session.role === 'admin' ? '/admin' : '/blogs'} replace />;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar session={session} />
      <main className="mx-auto max-w-md px-6 py-16">
        <section aria-labelledby="register-title" className="rounded-lg border border-slate-200 bg-white p-8">
          <h1 id="register-title" className="text-3xl font-semibold">Create your account</h1>
          <p className="mt-3 text-slate-600">Make room for your words.</p>
          <form onSubmit={handleRegister} noValidate aria-busy={submitting} className="mt-8 space-y-6">
            {fields.map(([name, label]) => (
              <div key={name}>
                <label htmlFor={'register-' + name} className="mb-2 block text-sm font-medium">{label}</label>
                <input id={'register-' + name} name={name} value={form[name]}
                  type={name.includes('assword') ? 'password' : 'text'}
                  autoComplete={name.includes('assword') ? 'new-password' : name === 'username' ? 'username' : 'nickname'}
                  onChange={(event) => { if (!gate.busy) setForm({ ...form, [name]: event.target.value }); }}
                  required aria-required="true" aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? name + '-error' : undefined}
                  className="w-full rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {errors[name] && <p id={name + '-error'} role="alert" className="mt-2 text-sm text-red-700">{errors[name]}</p>}
              </div>
            ))}
            {notice && <p role="alert" className="text-sm leading-6 text-red-700">{notice}</p>}
            <button type="submit" disabled={submitting || partial}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700
                focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="mt-6 text-sm">Already have an account? <Link to="/login" className="text-indigo-700 underline">Login</Link></p>
          <p className="mt-6 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600">
            Browser-local plain-text demo. Credentials are stored in plaintext in this browser.
            Do not use real passwords or sensitive information. This is not secure production authentication.
          </p>
        </section>
      </main>
    </div>
  );
}
RegisterPage.propTypes = { session: PropTypes.object, onSessionChange: PropTypes.func.isRequired };
