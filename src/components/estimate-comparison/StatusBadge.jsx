import { statusMeta, STATUS } from '../../lib/comparisonConfig.js';

/**
 * Status pill. Colour is never the only signal — the icon and the text are
 * always rendered, so the badge stays readable for colour-blind users and in
 * high-contrast or printed output.
 */
export default function StatusBadge({ status, compact = false, title = '' }) {
  const meta = statusMeta[status] || statusMeta[STATUS.NOT_STATED];

  return (
    <span className={`ec-status ec-status-${meta.tone}`} title={title || meta.description}>
      <span className="ec-status-icon" aria-hidden="true">
        {meta.icon}
      </span>
      <span className="ec-status-text">{compact ? meta.shortLabel : meta.label}</span>
    </span>
  );
}
