/** Provide responsive workspace and account disclosures. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink } from 'react-router-dom';
import { Avatar } from './Avatar';
/** Render navigation; mutations require explicit logout activation. */
export function Navbar({ session, onLogout }) {
  const [mobile, setMobile] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  /** Dismiss both disclosures. */
  function close() { setMobile(false); setDropdown(false); }
  const links = [['/blogs', 'All Blogs'], ['/write', 'Write']];
  if (session.role === 'admin') links.push(['/admin', 'Admin'], ['/users', 'Users']);
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav aria-label="Workspace" className="mx-auto max-w-6xl px-6 py-4"
        onKeyDown={(event) => { if (event.key === 'Escape') close(); }}>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/" onClick={close} className="font-serif text-2xl focus:ring-2 focus:ring-indigo-500">WriteSpace</Link>
          <button type="button" aria-expanded={mobile} aria-controls="workspace-links"
            aria-label={mobile ? 'Close menu' : 'Open menu'} onClick={() => setMobile(!mobile)}
            className="ml-auto rounded-lg border px-3 py-2 focus:ring-2 focus:ring-indigo-500 sm:hidden">Menu</button>
          <div id="workspace-links" className={mobile ? 'flex w-full flex-wrap gap-4 sm:w-auto' : 'hidden gap-4 sm:flex'}>
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} onClick={close} className={({ isActive }) =>
                'rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 ' +
                (isActive ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700 hover:bg-slate-50')}>
                {label}
              </NavLink>
            ))}
          </div>
          <div className="relative ml-auto min-w-0">
            <button type="button" aria-expanded={dropdown} aria-controls="account-actions"
              onClick={() => setDropdown(!dropdown)} className="flex items-center gap-2 rounded-lg focus:ring-2 focus:ring-indigo-500">
              <Avatar role={session.role} />
              <span className="max-w-32 break-all">{session.displayName}</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs">{session.role}</span>
            </button>
            {dropdown && (
              <div id="account-actions" className="absolute right-0 z-10 mt-2 rounded-lg border bg-white p-2">
                <button type="button" onClick={() => { close(); onLogout(); }}
                  className="rounded px-4 py-2 focus:ring-2 focus:ring-indigo-500">Logout</button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
Navbar.propTypes = { session: PropTypes.object.isRequired, onLogout: PropTypes.func.isRequired };
