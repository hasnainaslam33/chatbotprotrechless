import ComparisonReportResult from '../comparison-report/ComparisonReportResult.jsx';

export default function ResultsDashboard({ analysis, onStartOver }) {
  return <ComparisonReportResult analysis={analysis} onStartOver={onStartOver} />;
}
