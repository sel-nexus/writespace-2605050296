/** Read safe multiline text and delete only after fresh confirmed authorization. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { getSession } from '../utils/auth';
import { canModify, formatDate, getPosts, getUsers, readArrayForMutation, savePosts } from '../utils/storage';
/** Render a read-only snapshot with explicit eligible mutation controls. */
export default function ReadBlog({ session, onSessionChange = () => {} }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [gate] = useState(() => ({ busy: false, consumed: false }));
  useEffect(() => { setPost(getPosts().find((row) => row.id === id) || null); setUsers(getUsers()); }, [id]);
  /** Recheck actor and target both before and after native confirmation. */
  function remove() {
    if (gate.busy || gate.consumed) return;
    gate.busy = true;
    try {
      let actor = getSession();
      let posts = readArrayForMutation('writespace_posts');
      let target = posts.find((row) => row.id === id);
      if (!actor) { onSessionChange(null); navigate('/login', { replace: true }); return; }
      if (!target) { setPost(null); return; }
      if (!canModify(actor, target)) { navigate('/blogs', { replace: true }); return; }
      if (!window.confirm('Delete this post?')) return;
      actor = getSession();
      posts = readArrayForMutation('writespace_posts');
      target = posts.find((row) => row.id === id);
      if (!actor) { onSessionChange(null); navigate('/login', { replace: true }); return; }
      if (!target) { setPost(null); return; }
      if (!canModify(actor, target)) { navigate('/blogs', { replace: true }); return; }
      savePosts(posts.filter((row) => row.id !== id));
      gate.consumed = true; navigate('/blogs');
    } catch { setError('Browser storage prevented deletion. Please try again.'); }
    finally { gate.busy = false; }
  }
  if (!post) return (
    <section>
      <h1 className="text-3xl">Post not found</h1>
      <Link to="/blogs" className="text-indigo-700 underline">Back to blogs</Link>
    </section>
  );
  const role = post.authorId === 'admin' ? 'admin' : users.find((user) => user.id === post.authorId)?.role || 'user';
  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/blogs" className="text-indigo-700 underline focus:ring-2 focus:ring-indigo-500">Back to blogs</Link>
      <h1 className="mt-8 break-words font-serif text-4xl">{post.title}</h1>
      <div className="my-6 flex flex-wrap items-center gap-3">
        <Avatar role={role} />
        <span className="break-all">{post.authorName}</span>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs">{role}</span>
        <time dateTime={post.createdAt} className="text-sm text-slate-600">{formatDate(post.createdAt)}</time>
      </div>
      <p className="whitespace-pre-wrap break-words text-lg leading-8">{post.content}</p>
      {canModify(session, post) && (
        <div className="mt-8 flex gap-4">
          <Link to={'/edit/' + id} className="rounded-lg border border-indigo-300 px-4 py-2 text-indigo-700 focus:ring-2 focus:ring-indigo-500">
            Edit
          </Link>
          <button type="button" onClick={remove}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-600 focus:ring-2 focus:ring-red-500">Delete</button>
        </div>
      )}
      {error && <p role="alert" className="mt-6 text-red-700">{error}</p>}
    </article>
  );
}
ReadBlog.propTypes = { session: PropTypes.object.isRequired, onSessionChange: PropTypes.func };
