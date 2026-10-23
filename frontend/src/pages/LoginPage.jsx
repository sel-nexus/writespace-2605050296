/** Authenticate only the browser-local demonstration accounts. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Navigate, useNavigate } from 'react-router-dom';
import { setSession } from '../utils/auth';
import { readArrayForMutation } from '../utils/storage';

/** Persist a successful login before notifying the application.
 * Args:
 *   session: Application identity snapshot, or guest.
 *   onSessionChange: Callback after session persistence succeeds.
 * Returns:
 *   An accessible login form or signed-in role-home redirect.
 */
export default function LoginPage({ session, onSessionChange }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gate] = useState(() => ({ busy: false, consumed: false }));

  /** Reject duplicate attempts and retain input on validation or storage failure. */
  function handleLogin(event) {
    event.preventDefault();
    if (gate.busy || gate.consumed) return;
    gate.busy = true;
    setSubmitting(true);
    setError('');
    try {
      if (!username.trim() || !password.trim()) {
        setError('Invalid username or password.');
        return;
      }
      let next;
      if (username === 'admin' && password === 'admin') {
        next = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
      } else {
        const user = readArrayForMutation('writespace_users')
          .find((account) => account.username === username && account.password === password);
        if (!user) {
          setError('Invalid username or password.');
          return;
        }
        next = { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
      }
      setSession(next);
      gate.consumed = true;
      onSessionChange(next);
      navigate(next.role === 'admin' ? '/admin' : '/blogs', { replace: true });
    } catch {
      setError('Browser storage is unavailable or contains invalid data. Your login was not completed. Please try again.');
    } finally {
      gate.busy = false;
      setSubmitting(false);
    }
  }

  if (session) return <Navigate to={session.role === 'admin' ? '/admin' : '/blogs'} replace />;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8" aria-labelledby="login-title">
        <p className="mb-8 font-serif text-2xl">WriteSpace</p>
        <h1 id="login-title" className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-3 text-slate-600">Sign in to your local writing space.</p>
        <form onSubmit={handleLogin} noValidate className="mt-8 space-y-6" aria-busy={submitting}>
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium">Username</label>
            <input id="username" name="username" autoComplete="username" value={username}
              onChange={(event) => setUsername(event.target.value)} required aria-required="true"
              aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined}
              className="w-full rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" value={password}
              onChange={(event) => setPassword(event.target.value)} required aria-required="true"
              aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined}
              className="w-full rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {error && <p id="login-error" role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white
            hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-600">Demo administrator: admin / admin</p>
        <p className="mt-6 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600">
          Browser-local demo only. Credentials are stored in plaintext in this browser.
          Do not use real passwords or sensitive information. This is not secure production authentication.
        </p>
      </section>
    </main>
  );
}
LoginPage.propTypes = { session: PropTypes.object, onSessionChange: PropTypes.func.isRequired };
