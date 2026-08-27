import AISummary from './AISummary.jsx';
import CategoryScores from './CategoryScores.jsx';
import ComparisonTable from './ComparisonTable.jsx';
import ContractorQuestions from './ContractorQuestions.jsx';
import ContractorSummaryCards from './ContractorSummaryCards.jsx';
import KeyQuestionsComparison from './KeyQuestionsComparison.jsx';
import PriceComparison from './PriceComparison.jsx';
import RepairOptionsComparison from './RepairOptionsComparison.jsx';
import TopRisks from './TopRisks.jsx';
import WarrantyComparison from './WarrantyComparison.jsx';

export default function ResultsDashboard({ analysis, onStartOver }) {
  const { contractors = [], risks = [], keyQuestions = [], contractorQuestions = [], summary = '', disclaimer = '', mode = '' } = analysis;

  const unreadable = contractors.filter((contractor) => contractor.extractionMode && contractor.extractionMode !== 'openai');

  return (
    <div className="ec-results">
      <div className="ec-results-head">
        <div>
          <h2 className="ec-panel-title">Your estimate comparison</h2>
          <p className="mini">
            Everything below reflects only what is written in the documents you uploaded. Nothing was assumed, inferred, or filled in.
          </p>
        </div>
        <button type="button" className="btn secondary" onClick={onStartOver}>
          Start a new comparison
        </button>
      </div>

      {unreadable.length ? (
        <p className="ec-form-error" role="status">
          {unreadable.length === 1
            ? `We couldn't fully read the estimate for ${unreadable[0].contractorName}. Its rows show as Not Stated rather than guessed. Try a clearer PDF or image, or paste the text.`
            : `We couldn't fully read ${unreadable.length} of these estimates. Their rows show as Not Stated rather than guessed. Try clearer PDFs or images, or paste the text.`}
        </p>
      ) : null}

      {contractors.length === 1 ? (
        <p className="ec-single-note">
          You uploaded one estimate. The analysis below still applies, but comparison is where this tool earns its keep — a second and third
          quote will show you what this one leaves out.
        </p>
      ) : null}

      <ContractorSummaryCards contractors={contractors} />
      <TopRisks risks={risks} />
      <AISummary summary={summary} disclaimer={disclaimer} mode={mode} />
      <KeyQuestionsComparison questions={keyQuestions} contractors={contractors} />
      <WarrantyComparison contractors={contractors} />
      <PriceComparison contractors={contractors} />
      <RepairOptionsComparison contractors={contractors} />
      <ComparisonTable contractors={contractors} />
      <CategoryScores contractors={contractors} />
      <ContractorQuestions packs={contractorQuestions} contractors={contractors} />
    </div>
  );
}
