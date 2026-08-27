import { Fragment, useState } from 'react';
import { comparisonCategories, STATUS } from '../../lib/comparisonConfig.js';
import StatusBadge from './StatusBadge.jsx';

function FieldEvidence({ contractors, fieldKey }) {
  return (
    <div className="ec-evidence-grid">
      {contractors.map((contractor) => {
        const field = contractor.fields.find((item) => item.key === fieldKey);
        if (!field) return null;

        return (
          <div className="ec-evidence-card" key={contractor.id}>
            <div className="ec-evidence-head">
              <strong>{contractor.contractorName}</strong>
              <StatusBadge status={field.status} compact />
            </div>

            {field.value ? (
              <p className="ec-evidence-value">
                <span className="ec-evidence-label">Extracted:</span> {field.value}
              </p>
            ) : null}

            {field.sourceText ? (
              <blockquote className="ec-evidence-quote">
                “{field.sourceText}”
                {field.sourcePage ? <cite> — page {field.sourcePage}</cite> : null}
              </blockquote>
            ) : (
              <p className="ec-evidence-empty">
                {field.status === STATUS.NOT_STATED
                  ? 'No wording in this estimate addresses this item. It was not assumed either way.'
                  : 'No quotable source text was captured for this item.'}
              </p>
            )}

            {typeof field.confidence === 'number' ? (
              <span className="ec-confidence">Extraction confidence: {Math.round(field.confidence * 100)}%</span>
            ) : null}

            {field.status !== STATUS.INCLUDED && field.clarificationQuestion ? (
              <p className="ec-evidence-ask">Ask: “{field.clarificationQuestion}”</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CategoryBlock({ category, contractors, activeColumn, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expandedField, setExpandedField] = useState(null);

  const bodyId = `ec-cat-body-${category.id}`;

  return (
    <div className={`ec-category ${open ? 'is-open' : ''}`}>
      <button type="button" className="ec-category-head" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={bodyId}>
        <span className="ec-category-caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span className="ec-category-label">{category.label}</span>
        <span className="ec-category-scores">
          {contractors.map((contractor) => (
            <span className={`ec-category-score ec-col-${contractor.slot}`} key={contractor.id} title={`${contractor.contractorName}: ${contractor.categoryScores[category.id]}% documented`}>
              {contractor.categoryScores[category.id]}%
            </span>
          ))}
        </span>
      </button>

      {open ? (
        <div className="ec-category-body" id={bodyId}>
          {category.intro ? <p className="ec-category-intro">{category.intro}</p> : null}

          <div className="ec-table-scroll">
            <table className="ec-table" data-active={activeColumn}>
              <thead>
                <tr>
                  <th scope="col" className="ec-th-item">
                    Comparison Item
                  </th>
                  {contractors.map((contractor) => (
                    <th scope="col" className={`ec-col-${contractor.slot}`} key={contractor.id}>
                      {contractor.contractorName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {category.fields.map((field) => {
                  const isExpanded = expandedField === field.key;
                  return (
                    <Fragment key={field.key}>
                      <tr className={`ec-row ${field.highlight ? 'is-highlight' : ''} ${isExpanded ? 'is-expanded' : ''}`}>
                        <th scope="row" className="ec-td-item">
                          <button
                            type="button"
                            className="ec-row-toggle"
                            onClick={() => setExpandedField(isExpanded ? null : field.key)}
                            aria-expanded={isExpanded}
                          >
                            <span className="ec-row-caret" aria-hidden="true">
                              {isExpanded ? '−' : '+'}
                            </span>
                            <span>
                              {field.label}
                              {field.hint ? (
                                <span className="ec-tooltip" tabIndex={0} role="note" aria-label={field.hint}>
                                  <span aria-hidden="true">i</span>
                                  <span className="ec-tooltip-body">{field.hint}</span>
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </th>

                        {contractors.map((contractor) => {
                          const value = contractor.fields.find((item) => item.key === field.key);
                          return (
                            <td className={`ec-col-${contractor.slot}`} key={contractor.id}>
                              <StatusBadge status={value?.status} compact />
                              {value?.value ? <span className="ec-cell-value">{value.value}</span> : null}
                            </td>
                          );
                        })}
                      </tr>

                      {isExpanded ? (
                        <tr className="ec-evidence-row">
                          <td colSpan={contractors.length + 1}>
                            <FieldEvidence contractors={contractors} fieldKey={field.key} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Side-by-side comparison, grouped into collapsible categories.
 * On narrow screens a contractor selector replaces the extra columns rather
 * than squeezing four columns into a phone.
 */
export default function ComparisonTable({ contractors = [] }) {
  const [activeColumn, setActiveColumn] = useState(1);

  return (
    <section className="ec-section" aria-labelledby="ec-table-heading">
      <h2 className="ec-section-title" id="ec-table-heading">
        Side-by-side comparison
      </h2>
      <p className="mini ec-section-sub">
        Expand any category to compare it. Click a row to see the exact wording each status came from.
      </p>

      {contractors.length > 1 ? (
        <div className="ec-column-picker" role="tablist" aria-label="Choose which estimate to view on small screens">
          <span className="ec-column-picker-label">Viewing:</span>
          {contractors.map((contractor) => (
            <button
              key={contractor.id}
              type="button"
              role="tab"
              aria-selected={activeColumn === contractor.slot}
              className={`ec-column-tab ${activeColumn === contractor.slot ? 'is-active' : ''}`}
              onClick={() => setActiveColumn(contractor.slot)}
            >
              {contractor.contractorName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="ec-categories">
        {comparisonCategories.map((category, index) => (
          <CategoryBlock
            key={category.id}
            category={category}
            contractors={contractors}
            activeColumn={activeColumn}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
