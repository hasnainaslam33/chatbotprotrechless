import { Link } from 'react-router-dom';

const userOptions = ['Homeowner', 'Realtor', 'Property Manager', 'Restaurant Owner', 'Plumber', 'Home Inspector', 'Commercial Property Owner', 'Other'];

const benefitStatements = {
  Homeowner: 'Go from “My basement drain is backing up” to likely cause, repair options, and next steps in one guided experience.',
  Realtor: 'Go from “This deal may have a sewer issue” to risk level, clear next steps, and inspection scheduling in one guided experience.',
  'Property Manager': 'Go from “A tenant reported a drain backup” to urgency, service dispatch, and repair planning in one guided experience.',
  'Restaurant Owner': 'Go from “Our kitchen drain is slowing down” to grease-line risk, shutdown prevention, and service booking in one guided experience.',
  Plumber: 'Go from “This sewer job is beyond a normal cleaning” to defect review, trenchless options, and partner dispatch in one guided experience.',
  'Home Inspector': 'Go from “The sewer scope found a concern” to defect explanation, risk summary, and client-ready next steps in one guided experience.',
  'Commercial Property Owner': 'Go from “This property has recurring backups” to risk review, repair planning, and priority scheduling in one guided experience.',
  Other: 'Describe the problem, review the risk, compare next steps, and decide whether an inspection or second opinion makes sense.'
};

export default function HeroSection({ selectedType, onSelect }) {
  const benefitText = benefitStatements[selectedType] || benefitStatements.Other;

  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <span className="kicker">AI Sewer Decision Center</span>
          <h1>Instant Sewer &amp; Drain Answers</h1>
          <p className="lead">
            Describe your sewer or drain problem, upload a camera video or estimate, and get guided next steps before approving repair work.
          </p>
          <div className="hero-actions">
            <Link className="btn" to="/tools/symptom-checker">
              Check My Sewer Problem
            </Link>
            <Link className="btn secondary" to="/tools/sewer-camera-review">
              Upload My Camera Video
            </Link>
            <Link className="btn secondary" to="/tools/estimate-review">
              Compare My Estimate
            </Link>
            <Link className="btn warn" to="/tools/emergency-risk-check">
              Emergency Backup Risk Check
            </Link>
          </div>
          <div className="trust-row">
            <span>For homeowners</span>
            <span>Realtors</span>
            <span>Property managers</span>
            <span>Restaurants</span>
            <span>Plumbers</span>
            <span>Inspectors</span>
          </div>
        </div>

        <div className="panel chat-card">
          <div className="chat-top">
            <strong>Start here</strong>
            <span className="status">
              <span className="dot" /> Guidance available
            </span>
          </div>
          <div className="bubble ai">First, tell us who you are so the guidance fits your situation.</div>
          <div className="select-grid">
            {userOptions.map((option) => (
              <button
                key={option}
                className={`choice${selectedType === option ? ' active' : ''}`}
                type="button"
                onClick={() => onSelect(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="bubble user">{selectedType}</div>
          <div className="bubble ai">{benefitText}</div>
          <Link className="btn" to="/tools/symptom-checker">
            Continue to guided checker
          </Link>
          <p className="disclaimer">
            AI guidance is educational only. Final diagnosis and pricing require professional inspection and verification.
          </p>
        </div>
      </div>
    </section>
  );
}
