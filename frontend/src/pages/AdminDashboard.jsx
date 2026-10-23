/** Oversee readable local activity without changing storage during rendering. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard';
import { StatCard } from '../components/StatCard';
import { getSession } from '../utils/auth';
import { getPosts, getUsers, readArrayForMutation, savePosts } from '../utils/storage';

/** Show approved counts and the newest five posts with explicit actions.
 * Args:
 *   session: Authorized display identity; mutations re-read persistent identity.
 * Returns:
 *   Administrator statistics, quick links, and recent post oversight.
 */
export default function AdminDashboard({ session }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [gate] = useState(() => ({ busy: false, consumed: false }));
  useEffect(() => {
    setPosts(getPosts());
    setUsers(getUsers());
  }, []);

  /** Delete only a fresh target under current admin authority at both checks.
   * Args:
   *   id: Explicitly selected post identity.
   * Notes:
   *   Cancellation and every error stay on the dashboard without persistence.
   */
  function remove(id) {
    if (gate.busy || gate.consumed) return;
    gate.busy = true;
    setError('');
    try {
      if (getSession()?.role !== 'admin') {
        setError('Administrator access is required.');
        return;
      }
      let current = readArrayForMutation('writespace_posts');
      if (!current.some((post) => post.id === id)) {
        setError('Post not found');
        return;
      }
      if (!window.confirm('Delete this post?')) return;
      if (getSession()?.role !== 'admin') {
        setError('Administrator access is required.');
        return;
      }
      current = readArrayForMutation('writespace_posts');
      if (!current.some((post) => post.id === id)) {
        setError('Post not found');
        return;
      }
      savePosts(current.filter((post) => post.id !== id));
      gate.consumed = true;
      navigate('/blogs');
    } catch {
      setError('Browser storage prevented deletion. Please try again.');
    } finally {
      gate.busy = false;
    }
  }
  const recent = [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
  const accounts = users.length + 1;
  const admins = users.filter((user) => user.role === 'admin').length + 1;
  return (
    <section>
      <h1 className="font-serif text-4xl text-slate-900">Admin Dashboard</h1>
      <p className="mt-3 text-slate-600">Local writing and account activity at a glance.</p>
      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={posts.length} />
        <StatCard label="Total Users" value={accounts} />
        <StatCard label="Total Admins" value={admins} />
        <StatCard label="Total users" value={accounts} />
      </dl>
      <p className="mt-3 text-sm text-slate-600">Account counts include the default admin once. Both users totals include all accounts.</p>
      <nav aria-label="Quick actions" className="my-10 flex flex-wrap gap-4">
        <Link
          to="/write"
          className="rounded-lg bg-indigo-600 px-5 py-3 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
        >
          Write a blog
        </Link>
        <Link to="/users" className={
          'rounded-lg border border-slate-300 px-5 py-3 text-slate-700 hover:bg-white ' +
          'focus:ring-2 focus:ring-indigo-500'
        }>Manage users</Link>
      </nav>
      {error && <p role="alert" className="mb-6 text-red-700">{error}</p>}
      <h2 className="mb-6 text-2xl font-semibold">Recent posts</h2>
      {recent.length === 0 ? (
        <p className="text-slate-600">No blogs yet. Be the first to write one!</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((post, index) => (
            <div key={post.id} className="min-w-0">
              <BlogCard post={post} index={index} session={session} users={users} />
              <button type="button" onClick={() => remove(post.id)} aria-label={'Delete ' + post.title}
                className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-white focus:ring-2 focus:ring-indigo-500">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
AdminDashboard.propTypes = { session: PropTypes.object.isRequired };
