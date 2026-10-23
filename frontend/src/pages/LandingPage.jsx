/** Offer public discovery without bypassing protected readers. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getPosts } from '../utils/storage';
import { PublicNavbar } from '../components/PublicNavbar';

/** Display newest readable previews and browser-local limitations.
 * Args:
 *   session: Current identity used to choose reading entry.
 * Returns:
 *   A public editorial landing page.
 */
export default function LandingPage({ session }) {
  const [posts, setPosts] = useState([]);
  useEffect(() => { setPosts(getPosts()); }, []);
  const newest = [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicNavbar session={session} />
      <main className="mx-auto max-w-6xl px-6">
        <section className="grid min-h-screen items-center gap-12 py-24 md:grid-cols-2">
          <div>
            <h1 className="font-serif text-5xl leading-tight tracking-tight sm:text-6xl">
              Your thoughts. Your space. Beautifully simple.
            </h1>
            <p className="mt-6 max-w-prose text-lg leading-8 text-slate-600">A quiet place for your words, right in your browser.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to={session ? '/blogs' : '/login'}
                className="rounded-lg border border-slate-300 px-5 py-3 focus:ring-2 focus:ring-indigo-500">Start Reading</Link>
              <Link to="/register"
                className="rounded-lg bg-indigo-600 px-5 py-3 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500">
                Get Started Free
              </Link>
            </div>
            <p className="mt-8 text-sm leading-6 text-slate-600">
              Browser-local plain-text demo. Credentials are stored in plaintext in this browser.
              Do not use real passwords or sensitive information. Client-side roles are not secure production access control.
            </p>
          </div>
          <div aria-hidden="true" className="rounded-lg border border-slate-200 p-8 animate-bounce motion-reduce:animate-none">
            <p className="font-serif text-3xl">A little room to think.</p>
            <p className="mt-6 leading-8 text-slate-600">One page. Your words. No distractions.</p>
          </div>
        </section>
        <section aria-label="Features" className="grid gap-8 py-16 md:grid-cols-3">
          {['Write Freely', 'Private & Local', 'Instant & Fast'].map((title, index) => (
            <article key={title} className="border-t border-slate-200 pt-6">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-7 text-slate-600">
                {['Keep your writing simple with plain text.', 'Demo records stay in this browser, not on a server.',
                  'Open your space and start writing.'][index]}
              </p>
            </article>
          ))}
        </section>
        <section aria-labelledby="latest-title" className="py-16">
          <h2 id="latest-title" className="font-serif text-3xl">Latest posts</h2>
          {newest.length === 0 ? <p className="mt-8 text-slate-600">No posts yet — check back soon!</p> : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {newest.map((post) => (
                <article key={post.id} className="min-w-0 rounded-lg border border-slate-200 p-6">
                  <h3 className="break-words text-xl font-semibold">
                    <Link to={'/blog/' + post.id} className="focus:ring-2 focus:ring-indigo-500">{post.title}</Link>
                  </h3>
                  <p className="mt-4 break-words leading-7 text-slate-600">{post.content.slice(0, 120)}</p>
                  <time dateTime={post.createdAt} className="mt-6 block text-sm text-slate-600">
                    {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="border-t border-slate-200 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            {[['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']].map(([label, to]) => (
              <Link key={label} to={to} className="focus:ring-2 focus:ring-indigo-500">{label}</Link>
            ))}
          </nav>
          <p className="mt-6 text-sm text-slate-600">© {new Date().getFullYear()} WriteSpace. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
LandingPage.propTypes = { session: PropTypes.object };
