export default function AISummary({ summary = '', disclaimer = '', mode = '' }) {
  const degraded = mode && mode !== 'openai';

  return (
    <section className="ec-section ec-summary" aria-labelledby="ec-summary-ai-heading">
      <h2 className="ec-section-title" id="ec-summary-ai-heading">
        AI Estimate Review
      </h2>

      <div className="ec-summary-body">
        {summary
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>

      {degraded ? (
        <p className="mini ec-summary-note">
          This summary was generated from the extracted comparison data without an AI writing pass, so it is deliberately plain.
        </p>
      ) : null}

      {disclaimer ? (
        <div className="disclaimer">
          <strong>Disclaimer:</strong> {disclaimer}
        </div>
      ) : null}
    </section>
  );
}
