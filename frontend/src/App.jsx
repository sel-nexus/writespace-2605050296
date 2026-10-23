/** Own the local session snapshot and access-only route composition. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from './utils/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Avatar } from './components/Avatar';
import LoginPage from './pages/LoginPage';

/** Show honest temporary navigation without implementing future features.
 * Args:
 *   session: Current identity used for display.
 *   onSessionChange: Callback after successful logout.
 *   title: Destination label.
 * Returns:
 *   A protected navigation and explicitly unavailable content surface.
 */
function AccessSurface({ session, onSessionChange, title }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  /** Clear only the session and preserve signed-in state when removal fails. */
  function logout() {
    try {
      clearSession();
      onSessionChange(null);
      navigate('/', { replace: true });
    } catch {
      setError('Browser storage prevented logout. You are still signed in. Please try again.');
    }
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-5">
          <Link to="/" className="font-serif text-2xl focus:ring-2 focus:ring-indigo-500">WriteSpace</Link>
          <nav aria-label="Workspace" className="flex flex-wrap gap-4">
            <Link to="/blogs" className="text-indigo-700 underline focus:ring-2 focus:ring-indigo-500">All Blogs</Link>
            {session.role === 'admin' && (
              <Link to="/admin" className="text-indigo-700 underline focus:ring-2 focus:ring-indigo-500">Admin</Link>
            )}
          </nav>
          <div className="flex items-center gap-3 sm:ml-auto">
            <Avatar role={session.role} />
            <span className="break-all">{session.displayName}</span>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">{session.role}</span>
            <button onClick={logout} className="rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500">
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-4 max-w-prose leading-7 text-slate-600">
          You are signed in. This access-only workspace has no content tools yet.
          Blogging and administration will be added in their own feature slices.
        </p>
        {error && <p role="alert" className="mt-6 text-red-700">{error}</p>}
        <p className="mt-12 max-w-prose text-sm leading-6 text-slate-600">
          Browser-local demo: credentials are stored in plaintext. Do not use real passwords or sensitive information.
          Client-side roles are not secure production access control.
        </p>
      </main>
    </div>
  );
}
AccessSurface.propTypes = {
  session: PropTypes.object.isRequired, onSessionChange: PropTypes.func.isRequired, title: PropTypes.string.isRequired,
};

/** Initialize a read-only session snapshot and compose guarded entry routes.
 * Returns:
 *   Access routes; the single browser router belongs to the entry module.
 */
export default function App() {
  const [session, setSessionSnapshot] = useState(getSession);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage session={session} onSessionChange={setSessionSnapshot} />} />
      {['/blogs', '/blog/:id', '/write', '/edit/:id', '/admin', '/users'].map((path) => (
        <Route key={path} path={path} element={
          <ProtectedRoute role={['/admin', '/users'].includes(path) ? 'admin' : undefined}>
            <>
            {session && <AccessSurface session={session} onSessionChange={setSessionSnapshot}
              title={path === '/admin' ? 'Administrator workspace' : 'Writing workspace'} />}
            </>
          </ProtectedRoute>
        } />
      ))}
      <Route path="*" element={
        <main className="p-8">
          <h1 className="text-2xl">Page not found</h1>
          <Link to="/" className="text-indigo-700 underline">Back home</Link>
        </main>
      } />
    </Routes>
  );
}
