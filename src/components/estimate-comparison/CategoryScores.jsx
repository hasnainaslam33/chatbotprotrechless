import { scoreGroups } from '../../lib/comparisonConfig.js';

/**
 * Shows the weighting openly so the score is auditable rather than a black box.
 * Price is 5% by design — a cheaper quote cannot buy its way up this chart.
 */
export default function CategoryScores({ contractors = [] }) {
  return (
    <section className="ec-section" aria-labelledby="ec-scores-heading">
      <h2 className="ec-section-title" id="ec-scores-heading">
        How the scores are built
      </h2>
      <p className="mini ec-section-sub">
        Every estimate is measured against the identical criteria below. Contractor identity, brand, and reputation are not inputs, and
        price transparency is capped at 5% so a low bid cannot inflate a score.
      </p>

      <div className="ec-table-scroll">
        <table className="ec-table ec-scores-table">
          <thead>
            <tr>
              <th scope="col" className="ec-th-item">
                Category
              </th>
              <th scope="col" className="ec-th-weight">
                Weight
              </th>
              {contractors.map((contractor) => (
                <th scope="col" key={contractor.id}>
                  {contractor.contractorName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoreGroups.map((group) => (
              <tr key={group.id}>
                <th scope="row" className="ec-td-item">
                  {group.label}
                </th>
                <td className="ec-td-weight">{group.weight}%</td>
                {contractors.map((contractor) => {
                  const score = contractor.groupScores.find((item) => item.id === group.id)?.score ?? 0;
                  return (
                    <td key={`${group.id}-${contractor.id}`}>
                      <div className="ec-meter" role="img" aria-label={`${score} percent documented`}>
                        <span style={{ width: `${score}%` }} />
                      </div>
                      <span className="ec-meter-value">{score}%</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="ec-scores-total">
              <th scope="row" className="ec-td-item">
                Overall
              </th>
              <td className="ec-td-weight">100%</td>
              {contractors.map((contractor) => (
                <td key={`total-${contractor.id}`}>
                  <strong>{contractor.overallScore}/100</strong>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <details className="ec-evidence ec-scoring-note">
        <summary>How a status becomes a number</summary>
        <ul>
          <li>
            <strong>Clearly Included</strong> — full credit. The estimate confirms it in writing.
          </li>
          <li>
            <strong>Needs Clarification</strong> — partial credit. It is mentioned, but the wording is ambiguous.
          </li>
          <li>
            <strong>Not Stated</strong> — minimal credit. Silence is not the same as inclusion.
          </li>
          <li>
            <strong>Clearly Excluded</strong> — no completeness credit, because you would pay for it separately.
          </li>
          <li>
            On the <strong>Exclusions</strong> rows this flips: those are scored on disclosure, so a clearly written exclusion scores well
            and silence scores worst. A contractor who tells you up front that rock is extra is being more honest than one who says nothing.
          </li>
        </ul>
      </details>
    </section>
  );
}
