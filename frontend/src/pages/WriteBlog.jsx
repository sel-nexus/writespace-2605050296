/** Create or edit literal writing with strict persistence and a synchronous latch. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSession } from '../utils/auth';
import { canModify, getPosts, readArrayForMutation, savePosts } from '../utils/storage';
/** Preserve dirty input on failure and immutable metadata on edit. */
export default function WriteBlog({ session, onSessionChange = () => {} }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [missing, setMissing] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [gate] = useState(() => ({ busy: false, consumed: false }));
  useEffect(() => {
    if (!id) return;
    const post = getPosts().find((row) => row.id === id);
    if (!post) { setMissing(true); return; }
    if (!canModify(getSession(), post)) { navigate('/blogs', { replace: true }); return; }
    setTitle(post.title); setContent(post.content);
  }, [id, navigate]);
  /** Commit once per mounted form, rechecking current actor and target. */
  function save(event) {
    event.preventDefault();
    if (gate.busy || gate.consumed) return;
    gate.busy = true; setSubmitting(true);
    try {
      const fields = {};
      if (!title.trim()) fields.title = 'Title is required.';
      if (!content.trim()) fields.content = 'Content is required.';
      setErrors(fields);
      if (Object.keys(fields).length) return;
      const actor = getSession();
      if (!actor) { onSessionChange(null); navigate('/login', { replace: true }); return; }
      const posts = readArrayForMutation('writespace_posts');
      let updated;
      if (id) {
        const existing = posts.find((post) => post.id === id);
        if (!existing) { setMissing(true); return; }
        if (!canModify(actor, existing)) { navigate('/blogs', { replace: true }); return; }
        updated = { ...existing, title, content };
      } else {
        updated = { id: crypto.randomUUID(), title, content, createdAt: new Date().toISOString(),
          authorId: actor.userId, authorName: actor.displayName };
      }
      savePosts(id ? posts.map((post) => post.id === id ? updated : post) : [...posts, updated]);
      gate.consumed = true;
      navigate('/blog/' + updated.id);
    } catch {
      setErrors({ storage: 'Browser storage prevented saving. Your writing is retained. Please try again.' });
    } finally { gate.busy = false; setSubmitting(false); }
  }
  if (missing) return (
    <section>
      <h1 className="text-3xl">Post not found</h1>
      <Link to="/blogs" className="text-indigo-700 underline">Back to blogs</Link>
    </section>
  );
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="mb-8 font-serif text-4xl">{id ? 'Edit blog' : 'Write a blog'}</h1>
      <form onSubmit={save} noValidate className="space-y-6">
        <div>
          <label htmlFor="post-title" className="mb-2 block font-medium">Title</label>
          <input id="post-title" value={title} aria-required="true" aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'title-error' : undefined} onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500" />
          {errors.title && <p id="title-error" role="alert" className="text-red-700">{errors.title}</p>}
        </div>
        <div>
          <label htmlFor="post-content" className="mb-2 block font-medium">Content</label>
          <textarea id="post-content" value={content} aria-required="true" aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? 'content-error' : 'content-count'} onChange={(event) => setContent(event.target.value)}
            className="min-h-64 w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500" />
          <p id="content-count" className="text-sm text-slate-600">{content.length} characters</p>
          {errors.content && <p id="content-error" role="alert" className="text-red-700">{errors.content}</p>}
        </div>
        {errors.storage && <p role="alert" className="text-red-700">{errors.storage}</p>}
        <div className="flex flex-wrap gap-4">
          <button type="submit" disabled={submitting || gate.consumed}
            className="rounded-lg bg-indigo-600 px-5 py-3 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <Link to={id ? '/blog/' + id : '/blogs'} className="rounded-lg border px-5 py-3 text-slate-600 focus:ring-2 focus:ring-slate-500">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
WriteBlog.propTypes = { session: PropTypes.object.isRequired, onSessionChange: PropTypes.func };
