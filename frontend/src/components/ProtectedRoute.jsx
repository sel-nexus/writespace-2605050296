/** Keep protected content behind a validated session and optional role check. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession } from '../utils/auth';

/** Check current persistent identity before rendering children.
 * Args:
 *   children: Content available after authorization.
 *   role: Optional required administrator role.
 * Returns:
 *   Authorized content or a replacement redirect.
 */
export function ProtectedRoute({ children, role }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (role === 'admin' && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}
ProtectedRoute.propTypes = { children: PropTypes.node.isRequired, role: PropTypes.oneOf(['admin']) };
