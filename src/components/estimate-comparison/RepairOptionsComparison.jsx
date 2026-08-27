/**
 * Good / Better / Best comparison. Providing a single option is reported as a
 * transparency observation, not punished as a failing — some pipe conditions
 * genuinely have one sensible repair.
 */
export default function RepairOptionsComparison({ contractors = [] }) {
  const anyOptions = contractors.some((contractor) => contractor.repairOptions.length);
  if (!anyOptions) return null;

  return (
    <section className="ec-section" aria-labelledby="ec-options-heading">
      <h2 className="ec-section-title" id="ec-options-heading">
        Repair options offered
      </h2>
      <p className="mini ec-section-sub">
        Multiple documented options show the contractor weighed alternatives against your pipe condition. One option is not automatically a
        problem — but it should be explained.
      </p>

      <div className={`ec-options-grid ec-options-grid-${contractors.length}`}>
        {contractors.map((contractor) => (
          <div className="ec-options-column" key={contractor.id}>
            <h3 className="ec-subsection-title">{contractor.contractorName}</h3>

            {contractor.repairOptions.length === 0 ? (
              <p className="ec-options-single">No repair options were described in this estimate.</p>
            ) : contractor.repairOptions.length === 1 ? (
              <p className="ec-options-single">Only one repair option provided</p>
            ) : (
              <p className="mini">{contractor.repairOptions.length} options documented</p>
            )}

            {contractor.repairOptions.map((option) => (
              <article className="ec-option-card" key={option.id}>
                <header>
                  <h4 className="ec-option-name">{option.name}</h4>
                  {option.price ? <span className="ec-option-price">{option.price}</span> : null}
                </header>

                <dl className="ec-option-facts">
                  {option.method ? (
                    <div>
                      <dt>Method</dt>
                      <dd>{option.method}</dd>
                    </div>
                  ) : null}
                  {option.expectedServiceLife ? (
                    <div>
                      <dt>Expected service life</dt>
                      <dd>{option.expectedServiceLife}</dd>
                    </div>
                  ) : null}
                  {option.warranty ? (
                    <div>
                      <dt>Warranty</dt>
                      <dd>{option.warranty}</dd>
                    </div>
                  ) : null}
                  {option.advantages ? (
                    <div>
                      <dt>Advantages</dt>
                      <dd>{option.advantages}</dd>
                    </div>
                  ) : null}
                  {option.limitations ? (
                    <div>
                      <dt>Limitations</dt>
                      <dd>{option.limitations}</dd>
                    </div>
                  ) : null}
                  {option.whyRecommended ? (
                    <div>
                      <dt>Why recommended</dt>
                      <dd>{option.whyRecommended}</dd>
                    </div>
                  ) : null}
                  {option.fitForDocumentedCondition ? (
                    <div>
                      <dt>Fit for the documented pipe condition</dt>
                      <dd>{option.fitForDocumentedCondition}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
