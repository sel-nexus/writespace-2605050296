/** List readable posts without repairing stored bytes. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard';
import { getPosts, getUsers } from '../utils/storage';
/** Load newest-first snapshots with stable tied-date ordering. */
export default function Home({ session }) {
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  useEffect(() => {
    setPosts(getPosts().slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    setUsers(getUsers());
  }, []);
  return (
    <section>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl">All Blogs</h1>
        <Link to="/write" className="rounded-lg bg-indigo-600 px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500">Write a blog</Link>
      </div>
      {posts.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} session={session} users={users} />
          ))}
        </div>
      ) : <p className="py-16 text-slate-600">No blogs yet. Be the first to write one!</p>}
    </section>
  );
}
Home.propTypes = { session: PropTypes.object.isRequired };
