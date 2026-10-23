/** Present role-aware public navigation with a keyboard-operable mobile disclosure. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';

/** Route public visitors to entry or their role home.
 * Args:
 *   session: Current application identity, or guest.
 * Returns:
 *   One sticky navigation header.
 */
export function PublicNavbar({ session }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link to="/" onClick={() => setOpen(false)} className="font-serif text-2xl focus:ring-2 focus:ring-indigo-500">
          WriteSpace
        </Link>
        <button type="button" aria-expanded={open} aria-controls="public-navigation"
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 sm:hidden">
          {open ? 'Close menu' : 'Open menu'}
        </button>
        <nav id="public-navigation" aria-label="Public"
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
          className={open ? 'flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center' :
            'hidden w-full flex-col gap-4 sm:flex sm:w-auto sm:flex-row sm:items-center'}>
          {session ? (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar role={session.role} />
                <span className="break-all">{session.displayName}</span>
                <span className={session.role === 'admin' ?
                  'rounded bg-violet-100 px-2 py-1 text-xs text-violet-700' :
                  'rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700'}>{session.role}</span>
              </div>
              <Link to={session.role === 'admin' ? '/admin' : '/blogs'} onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500">
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="focus:ring-2 focus:ring-indigo-500">Login</Link>
              <Link to="/register" onClick={() => setOpen(false)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500">
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
PublicNavbar.propTypes = { session: PropTypes.object };
