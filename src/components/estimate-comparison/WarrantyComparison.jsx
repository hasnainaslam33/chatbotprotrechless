import { categoryById, STATUS } from '../../lib/comparisonConfig.js';
import StatusBadge from './StatusBadge.jsx';

const WARRANTY_TYPE_KEYS = [
  'manufacturer_product_warranty',
  'contractor_material_warranty',
  'contractor_labor_warranty',
  'parts_and_labor_warranty',
  'workmanship_warranty',
  'structural_warranty',
  'warranty_restoration_coverage',
  'warranty_cleanout_coverage',
  'warranty_connection_coverage'
];

const COVERAGE_KEYS = [
  'warranty_length',
  'warranty_prorated',
  'warranty_transferable',
  'warranty_transfer_fee',
  'warranty_labor_after_transfer',
  'warranty_diagnostic_costs',
  'warranty_excavation_covered',
  'warranty_removal_covered',
  'warranty_reinstallation_covered',
  'warranty_surface_restoration_covered'
];

const HIGHLIGHT_KEY = 'contractor_transferable_labor_material_protection';

function fieldFor(contractor, key) {
  return contractor.fields.find((item) => item.key === key);
}

function MiniMatrix({ title, keys, contractors, caption }) {
  const category = categoryById.warranty;
  return (
    <div className="ec-warranty-block">
      <h3 className="ec-subsection-title">{title}</h3>
      {caption ? <p className="mini">{caption}</p> : null}
      <div className="ec-table-scroll">
        <table className="ec-table">
          <thead>
            <tr>
              <th scope="col" className="ec-th-item">
                Warranty item
              </th>
              {contractors.map((contractor) => (
                <th scope="col" key={contractor.id}>
                  {contractor.contractorName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const label = category.fields.find((field) => field.key === key)?.label || key;
              return (
                <tr key={key}>
                  <th scope="row" className="ec-td-item">
                    {label}
                  </th>
                  {contractors.map((contractor) => {
                    const field = fieldFor(contractor, key);
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
        </table>
      </div>
    </div>
  );
}

/**
 * Warranty is deliberately never collapsed into one generic "Warranty" row.
 * Product, material, labor, transfer, and what a claim actually pays for are
 * separate questions with separate answers.
 */
export default function WarrantyComparison({ contractors = [] }) {
  return (
    <section className="ec-section ec-warranty" aria-labelledby="ec-warranty-heading">
      <h2 className="ec-section-title" id="ec-warranty-heading">
        Warranty comparison
      </h2>
      <p className="mini ec-section-sub">
        A “lifetime warranty” headline tells you nothing on its own. What matters is who pays for labor, excavation, removal,
        reinstallation, restoration, and diagnostics — and whether any of it survives when you sell the house.
      </p>

      <div className="ec-warranty-highlight">
        <h3 className="ec-subsection-title">Contractor-backed transferable labor + material protection</h3>
        <p className="mini">
          Does the contractor provide its own transferable labor-and-material warranty above and beyond the manufacturer’s product warranty?
          A manufacturer product warranty may replace the product only — not the labor, excavation, removal, reinstallation, connections,
          cleanup, restoration, or diagnostic work needed to use it.
        </p>

        <div className={`ec-highlight-grid ec-highlight-grid-${contractors.length}`}>
          {contractors.map((contractor) => {
            const field = fieldFor(contractor, HIGHLIGHT_KEY);
            return (
              <div className="ec-highlight-card" key={contractor.id}>
                <strong>{contractor.contractorName}</strong>
                <StatusBadge status={field?.status} />
                {field?.value ? <p className="ec-highlight-value">{field.value}</p> : null}
                {field?.sourceText ? (
                  <details className="ec-evidence">
                    <summary>Show the wording</summary>
                    <blockquote>“{field.sourceText}”</blockquote>
                  </details>
                ) : (
                  <p className="ec-evidence-empty">
                    {field?.status === STATUS.NOT_STATED ? 'The estimate does not address this.' : 'No quotable source text captured.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <MiniMatrix
        title="Which warranties are documented"
        keys={WARRANTY_TYPE_KEYS}
        contractors={contractors}
        caption="Each warranty type is evaluated separately — one being present says nothing about the others."
      />

      <MiniMatrix
        title="What a warranty claim actually pays for"
        keys={COVERAGE_KEYS}
        contractors={contractors}
        caption="These determine what a claim costs you out of pocket five years from now."
      />

      {contractors.some((contractor) => contractor.warranties.length) ? (
        <div className="ec-warranty-block">
          <h3 className="ec-subsection-title">Warranty terms as written in each estimate</h3>
          <div className={`ec-highlight-grid ec-highlight-grid-${contractors.length}`}>
            {contractors.map((contractor) => (
              <div className="ec-highlight-card" key={contractor.id}>
                <strong>{contractor.contractorName}</strong>
                {contractor.warranties.length ? (
                  <ul className="ec-warranty-terms">
                    {contractor.warranties.map((warranty, index) => (
                      <li key={`${contractor.id}-warranty-${index}`}>
                        <span className="ec-warranty-type">{warranty.type}</span>
                        <dl>
                          {warranty.length ? (
                            <div>
                              <dt>Length</dt>
                              <dd>{warranty.length}</dd>
                            </div>
                          ) : null}
                          {warranty.prorated ? (
                            <div>
                              <dt>Prorated</dt>
                              <dd>{warranty.prorated}</dd>
                            </div>
                          ) : null}
                          {warranty.transferable ? (
                            <div>
                              <dt>Transferable</dt>
                              <dd>{warranty.transferable}</dd>
                            </div>
                          ) : null}
                          {warranty.transferFee ? (
                            <div>
                              <dt>Transfer fee</dt>
                              <dd>{warranty.transferFee}</dd>
                            </div>
                          ) : null}
                          {warranty.laborIncluded ? (
                            <div>
                              <dt>Labor</dt>
                              <dd>{warranty.laborIncluded}</dd>
                            </div>
                          ) : null}
                          {warranty.materialsIncluded ? (
                            <div>
                              <dt>Materials</dt>
                              <dd>{warranty.materialsIncluded}</dd>
                            </div>
                          ) : null}
                          {warranty.exclusions ? (
                            <div>
                              <dt>Exclusions</dt>
                              <dd>{warranty.exclusions}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ec-evidence-empty">No warranty terms were written in this estimate.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
