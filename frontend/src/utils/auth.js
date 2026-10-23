/** Serialize local demo sessions, not credentials or authoritative tokens. */
const SESSION_KEY = 'writespace_session';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Require the exact session fields before allowing identity consumption.
 * Args:
 *   session: Untrusted candidate identity snapshot.
 * Returns:
 *   The original validated session without normalization.
 * Raises:
 *   TypeError: Missing, extra, blank, or invalid identity/role fields.
 */
function validateSession(session) {
  const fields = ['userId', 'username', 'displayName', 'role'];
  if (!session || typeof session !== 'object' || Array.isArray(session)
    || Object.keys(session).length !== fields.length
    || !fields.every((field) => Object.hasOwn(session, field)
      && typeof session[field] === 'string' && session[field].trim().length > 0)
    || (session.userId !== 'admin' && !UUID.test(session.userId))
    || !['admin', 'user'].includes(session.role)) {
    throw new TypeError('Invalid session.');
  }
  return session;
}

/** Fail closed when the saved session is absent, corrupt, or inaccessible.
 * Returns:
 *   An exact valid session or null; never changes stored bytes or raises.
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw === null ? null : validateSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persist a validated identity snapshot before callers announce login.
 * Args:
 *   obj: Exact session identity fields, without credentials.
 * Returns:
 *   Nothing after persistence completes.
 * Raises:
 *   Error: Invalid session, serialization failure, or storage write failure.
 */
export function setSession(obj) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(validateSession(obj)));
}

/** Remove only the session before callers announce persistent logout.
 * Returns:
 *   Nothing after removal completes, including when already absent.
 * Raises:
 *   Error: Storage access or removal is denied.
 */
export function clearSession() { localStorage.removeItem(SESSION_KEY); }
