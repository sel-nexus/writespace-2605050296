/** Present static role illustrations without identity claims. */
import PropTypes from 'prop-types';

/** Return a crown for administrators and an open book for readers.
 * Args:
 *   role: Role whose illustration is requested.
 * Returns:
 *   A decorative, static SVG avatar.
 */
export function getAvatar(role) {
  const admin = role === 'admin';
  return (
    <span className={admin ? 'inline-flex rounded-lg bg-violet-100 p-2 text-violet-700' :
      'inline-flex rounded-lg bg-indigo-100 p-2 text-indigo-700'}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        {admin ? <path d="M3 6l4 4 5-6 5 6 4-4-2 12H5L3 6zm2 15h14" /> :
          <path d="M12 5v15M3 4c4-1 7 0 9 1 2-1 5-2 9-1v15c-4-1-7 0-9 1-2-1-5-2-9-1V4z" />}
      </svg>
    </span>
  );
}
/** Render the role illustration.
 * Args:
 *   role: Current display role.
 * Returns:
 *   A decorative avatar.
 */
export function Avatar({ role }) {
  return getAvatar(role);
}
Avatar.propTypes = { role: PropTypes.oneOf(['admin', 'user']).isRequired };
