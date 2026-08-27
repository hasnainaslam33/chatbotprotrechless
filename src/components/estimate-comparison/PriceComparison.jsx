import { categoryById } from '../../lib/comparisonConfig.js';
import StatusBadge from './StatusBadge.jsx';

const COST_RISK_KEYS = [
  'price_additional_footage',
  'price_additional_excavation',
  'price_additional_cleanouts',
  'rock_charges',
  'groundwater_charges',
  'emergency_charges',
  'weekend_charges',
  'change_order_terms',
  'cancellation_terms'
];

const INCLUSION_KEYS = ['taxes', 'price_permit_costs', 'price_inspection_costs', 'restoration_costs', 'disposal_costs', 'mobilization'];

function formatPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return `$${value.toLocaleString()}`;
}

function KeyRows({ keys, contractors }) {
  const category = categoryById.price;
  return (
    <tbody>
      {keys.map((key) => {
        const label = category.fields.find((field) => field.key === key)?.label || key;
        return (
          <tr key={key}>
            <th scope="row" className="ec-td-item">
              {label}
            </th>
            {contractors.map((contractor) => {
              const field = contractor.fields.find((item) => item.key === key);
              return (
                <td key={`${key}-${contractor.id}`}>
                  <StatusBadge status={field?.status} compact />
                  {field?.value ? <span className="ec-cell-value">{field.value}</span> : null}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}

/**
 * Price section. Ranks nothing by cheapness — it shows what each price does and
 * does not cover, and how additional cost is defined before work begins.
 */
export default function PriceComparison({ contractors = [] }) {
  const priced = contractors.filter((contractor) => Number.isFinite(contractor.totalPrice) && contractor.totalPrice > 0);
  const spread =
    priced.length >= 2 ? Math.max(...priced.map((c) => c.totalPrice)) - Math.min(...priced.map((c) => c.totalPrice)) : null;

  return (
    <section className="ec-section" aria-labelledby="ec-price-heading">
      <h2 className="ec-section-title" id="ec-price-heading">
        Price &amp; payment
      </h2>
      <p className="mini ec-section-sub">
        A lower number is not automatically a better deal. Two prices are only comparable when they cover the same scope — which is what
        the rest of this page is measuring.
      </p>

      <div className={`ec-price-grid ec-price-grid-${contractors.length}`}>
        {contractors.map((contractor) => (
          <div className="ec-price-card" key={contractor.id}>
            <span className="ec-price-name">{contractor.contractorName}</span>
            <span className="ec-price-value">{formatPrice(contractor.totalPrice) || 'Not stated'}</span>
            <span className="mini">
              Price transparency score: {contractor.groupScores.find((group) => group.id === 'price')?.score ?? 0}%
            </span>
          </div>
        ))}
      </div>

      {spread !== null && spread > 0 ? (
        <p className="ec-price-spread">
          The stated totals differ by <strong>${spread.toLocaleString()}</strong>. Check the scope rows below before treating that gap as a
          saving — a lower price often reflects work that is not in the quote.
        </p>
      ) : null}

      <div className="ec-table-scroll">
        <table className="ec-table">
          <thead>
            <tr>
              <th scope="col" className="ec-th-item">
                What the price includes
              </th>
              {contractors.map((contractor) => (
                <th scope="col" key={contractor.id}>
                  {contractor.contractorName}
                </th>
              ))}
            </tr>
          </thead>
          <KeyRows keys={INCLUSION_KEYS} contractors={contractors} />
        </table>
      </div>

      <h3 className="ec-subsection-title">Additional-cost terms</h3>
      <p className="mini">These are the numbers that decide what happens when something unexpected is found mid-project.</p>
      <div className="ec-table-scroll">
        <table className="ec-table">
          <thead>
            <tr>
              <th scope="col" className="ec-th-item">
                Additional cost item
              </th>
              {contractors.map((contractor) => (
                <th scope="col" key={contractor.id}>
                  {contractor.contractorName}
                </th>
              ))}
            </tr>
          </thead>
          <KeyRows keys={COST_RISK_KEYS} contractors={contractors} />
        </table>
      </div>
    </section>
  );
}
