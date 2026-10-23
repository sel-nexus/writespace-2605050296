/** Preserve browser-local records with validated, non-destructive reads. */
const POST_KEY = 'writespace_posts';
const USER_KEY = 'writespace_users';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Recognize required text without normalizing its persisted bytes.
 * Args:
 *   value: Candidate field from an untrusted record.
 * Returns:
 *   Whether the field contains non-whitespace text.
 */
function nonblank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate an entire known collection rather than salvaging individual rows.
 * Args:
 *   key: Supported posts or users storage key.
 *   records: Candidate array to return or persist unchanged.
 * Returns:
 *   The validated original array.
 * Raises:
 *   TypeError: Unknown key, invalid schema, or ambiguous identities.
 */
function validateArray(key, records) {
  if (key !== POST_KEY && key !== USER_KEY) throw new TypeError('Unknown collection key.');
  if (!Array.isArray(records)) throw new TypeError('Expected a record array.');
  const fields = key === POST_KEY
    ? ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName']
    : ['id', 'displayName', 'username', 'password', 'role', 'createdAt'];
  const ids = new Set();
  const usernames = new Set();
  for (const row of records) {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || Object.keys(row).length !== fields.length
      || !fields.every((field) => Object.hasOwn(row, field) && nonblank(row[field]))) {
      throw new TypeError('Invalid record fields.');
    }
    if (!UUID.test(row.id) || ids.has(row.id.toLowerCase())) throw new TypeError('Invalid or duplicate ID.');
    ids.add(row.id.toLowerCase());
    if (!ISO_TIME.test(row.createdAt) || !Number.isFinite(Date.parse(row.createdAt))) {
      throw new TypeError('Invalid creation timestamp.');
    }
    if (key === POST_KEY) {
      if (row.authorId !== 'admin' && !UUID.test(row.authorId)) throw new TypeError('Invalid author reference.');
    } else {
      if (!['admin', 'user'].includes(row.role)) throw new TypeError('Invalid account role.');
      if (row.username === 'admin' || usernames.has(row.username)) throw new TypeError('Reserved or duplicate username.');
      usernames.add(row.username);
    }
  }
  return records;
}

/** Read current records before an intentional mutation without repairing data.
 * Args:
 *   key: writespace_posts or writespace_users.
 * Returns:
 *   Valid records, or a new empty array only when the key is absent.
 * Raises:
 *   Error: Denied storage access, malformed JSON, or invalid collection data.
 */
export function readArrayForMutation(key) {
  validateArray(key, []);
  const raw = localStorage.getItem(key);
  return raw === null ? [] : validateArray(key, JSON.parse(raw));
}

/** Read a display snapshot while retaining inaccessible or corrupt bytes.
 * Args:
 *   key: Known collection key.
 * Returns:
 *   Valid records or an empty display fallback; never writes or raises.
 */
function readForDisplay(key) {
  try {
    return readArrayForMutation(key);
  } catch {
    return [];
  }
}

/** Return readable posts without granting permission to reset corrupt data.
 * Returns:
 *   Exact valid posts, or an empty non-destructive fallback.
 */
export function getPosts() { return readForDisplay(POST_KEY); }

/** Replace posts only after validating every supplied record.
 * Args:
 *   arr: Complete intended post collection, retaining text and metadata.
 * Returns:
 *   Nothing after persistence completes.
 * Raises:
 *   Error: Invalid records, serialization failure, or denied/quota-limited write.
 */
export function savePosts(arr) {
  localStorage.setItem(POST_KEY, JSON.stringify(validateArray(POST_KEY, arr)));
}

/** Return readable accounts without synthesizing or persisting default admin.
 * Returns:
 *   Exact valid accounts, or an empty non-destructive fallback.
 */
export function getUsers() { return readForDisplay(USER_KEY); }

/** Replace accounts only after validating schema and identity uniqueness.
 * Args:
 *   arr: Complete intended stored account collection.
 * Returns:
 *   Nothing after persistence completes.
 * Raises:
 *   Error: Invalid records, serialization failure, or denied/quota-limited write.
 */
export function saveUsers(arr) {
  localStorage.setItem(USER_KEY, JSON.stringify(validateArray(USER_KEY, arr)));
}

/** Return native English creation date text. */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
/** Retain the first 120 literal characters. */
export function excerpt(content) { return content.slice(0, 120); }
/** Authorize only administrators or the current author. */
export function canModify(session, post) {
  return Boolean(session && post && (session.role === 'admin' || session.userId === post.authorId));
}
