/** Present literal post previews and author metadata. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { canModify, excerpt, formatDate } from '../utils/storage';
const accents = ['border-t-indigo-300', 'border-t-violet-300', 'border-t-pink-300', 'border-t-slate-300'];
/** Render a preview with eligible edit controls and role fallback. */
export function BlogCard({ post, index = 0, session, users = [], onEdit }) {
  const role = post.authorId === 'admin' ? 'admin' : users.find((user) => user.id === post.authorId)?.role || 'user';
  return (
    <article className={'min-w-0 rounded-lg border border-t-2 bg-white p-6 ' + accents[index % 4]}>
      <h2 className="break-words font-serif text-2xl">
        <Link to={'/blog/' + post.id} className="focus:ring-2 focus:ring-indigo-500">{post.title}</Link>
      </h2>
      <p className="mt-4 break-words text-slate-600">{excerpt(post.content)}</p>
      <div className="mt-6 flex items-center gap-3">
        <Avatar role={role} />
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{post.authorName}</p>
          <span className="rounded bg-slate-100 px-2 text-xs">{role}</span>
          <time dateTime={post.createdAt} className="ml-2 text-xs text-slate-600">{formatDate(post.createdAt)}</time>
        </div>
      </div>
      {canModify(session, post) && (
        <div className="mt-6">
          {onEdit ? (
            <button type="button" onClick={() => onEdit(post.id)} className="text-indigo-700 underline focus:ring-2 focus:ring-indigo-500">
              Edit
            </button>
          ) : (
            <Link to={'/edit/' + post.id} className="text-indigo-700 underline focus:ring-2 focus:ring-indigo-500">Edit</Link>
          )}
        </div>
      )}
    </article>
  );
}
BlogCard.propTypes = {
  post: PropTypes.object.isRequired, index: PropTypes.number, session: PropTypes.object,
  users: PropTypes.array, onEdit: PropTypes.func,
};
