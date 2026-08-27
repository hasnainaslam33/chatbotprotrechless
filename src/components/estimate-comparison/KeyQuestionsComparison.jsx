import StatusBadge from './StatusBadge.jsx';

/**
 * The 12 questions section. Each answer is the weakest supporting field, so a
 * question only reads as "Clearly Included" when every part of it is documented.
 */
export default function KeyQuestionsComparison({ questions = [], contractors = [] }) {
  return (
    <section className="ec-section" aria-labelledby="ec-questions-heading">
      <h2 className="ec-section-title" id="ec-questions-heading">
        Questions Every Homeowner Should Ask
      </h2>
      <p className="mini ec-section-sub">
        A question is only marked as covered when every part of it is written into the estimate.
      </p>

      <div className="ec-table-scroll">
        <table className="ec-table ec-questions-table">
          <thead>
            <tr>
              <th scope="col" className="ec-th-item">
                Question
              </th>
              {contractors.map((contractor) => (
                <th scope="col" key={contractor.id}>
                  {contractor.contractorName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map((question, index) => (
              <tr key={question.id}>
                <th scope="row" className="ec-td-item">
                  <span className="ec-question-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  {question.question}
                </th>
                {question.answers.map((answer) => (
                  <td key={`${question.id}-${answer.contractorId}`}>
                    <StatusBadge status={answer.status} compact />
                    {answer.drivingField ? <span className="ec-cell-value">Weakest item: {answer.drivingField.label}</span> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
