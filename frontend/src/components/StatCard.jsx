/** Present an approved account or post count without inventing another metric. */
import PropTypes from 'prop-types';

/** Render a literal label with a readable tabular count.
 * Args:
 *   label: Approved statistic wording.
 *   value: Readable collection count.
 * Returns:
 *   A flat statistic surface.
 */
export function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
StatCard.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.number.isRequired };
