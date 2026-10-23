/** Own the local session snapshot and access-only route composition. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from './utils/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import { Navbar } from './components/Navbar';
import Home from './pages/Home';
import ReadBlog from './pages/ReadBlog';
import WriteBlog from './pages/WriteBlog';
import AdminDashboard from './pages/AdminDashboard';

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
      <Navbar session={session} onLogout={logout} />
      <main className="mx-auto max-w-6xl px-6 py-16">
        {title === '/blogs' ? <Home session={session} /> :
          title.startsWith('/blog/') ? <ReadBlog session={session} onSessionChange={onSessionChange} /> :
          title === '/write' || title.startsWith('/edit/') ? <WriteBlog key={title} session={session} onSessionChange={onSessionChange} /> :
          title === '/admin' ? <AdminDashboard session={session} /> : (
            <section>
              <h1 className="text-3xl font-semibold">Administrator workspace</h1>
              <p className="mt-4 text-slate-600">Administration tools are not available in this feature slice.</p>
            </section>
          )}
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
      <Route path="/" element={<LandingPage session={session} />} />
      <Route path="/register" element={
        <RegisterPage session={session} onSessionChange={setSessionSnapshot} />
      } />
      <Route path="/login" element={<LoginPage session={session} onSessionChange={setSessionSnapshot} />} />
      {['/blogs', '/blog/:id', '/write', '/edit/:id', '/admin', '/users'].map((path) => (
        <Route key={path} path={path} element={
          <ProtectedRoute role={['/admin', '/users'].includes(path) ? 'admin' : undefined}>
            <>
            {session && <AccessSurface session={session} onSessionChange={setSessionSnapshot}
              title={path} />}
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
