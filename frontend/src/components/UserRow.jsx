/** Present account metadata without ever rendering credentials. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar';
import { formatDate } from '../utils/storage';

/** Render a semantic table row or its small-screen card equivalent.
 * Args:
 *   user: Account metadata; passwords are never consumed.
 *   session: Display identity used to disable self deletion.
 *   onDelete: Explicit deletion action.
 *   isDefault: Whether this is the synthesized administrator.
 *   mobile: Render a card rather than a table row.
 * Returns:
 *   Metadata and an eligibility-aware action.
 */
export function UserRow({ user, session, onDelete, isDefault = false, mobile = false }) {
  const protectedDefault = isDefault || user.id === 'admin';
  const disabled = protectedDefault || user.id === session?.userId;
  const tooltip = protectedDefault ? 'Default admin cannot be deleted.' : disabled ? 'Your current account cannot be deleted.' : undefined;
  const identity = (
    <div className="flex items-center gap-3">
      <Avatar role={user.role} />
      <span className="break-all font-medium">{user.displayName}</span>
    </div>
  );
  const role = (
    <span className={user.role === 'admin' ? 'rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-800' : 'rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-800'}>
      {user.role}
    </span>
  );
  const date = protectedDefault ? 'Unavailable' : (
    <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>
  );
  const action = (
    <span title={tooltip}>
      <button type="button" disabled={disabled} title={tooltip} aria-label={'Delete ' + user.username}
        onClick={() => onDelete(user.id)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
        Delete
      </button>
    </span>
  );
  if (mobile) return (
    <article aria-label={'Account ' + user.username} className="rounded-lg border border-slate-200 bg-white p-4">
      {identity}
      <dl className="my-4 grid grid-cols-2 gap-3 text-sm">
        <dt className="text-slate-600">Username</dt>
        <dd className="break-all">{user.username}</dd>
        <dt className="text-slate-600">Role</dt>
        <dd>{role}</dd>
        <dt className="text-slate-600">Created</dt>
        <dd>{date}</dd>
      </dl>
      {action}
    </article>
  );
  return (
    <tr className="border-t border-slate-200">
      <td className="p-4">{identity}</td>
      <td className="break-all p-4">{user.username}</td>
      <td className="p-4">{role}</td>
      <td className="p-4 text-sm text-slate-600">{date}</td>
      <td className="p-4">{action}</td>
    </tr>
  );
}
UserRow.propTypes = {
  user: PropTypes.shape({ id: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string }).isRequired,
  session: PropTypes.object, onDelete: PropTypes.func.isRequired,
  isDefault: PropTypes.bool, mobile: PropTypes.bool,
};
