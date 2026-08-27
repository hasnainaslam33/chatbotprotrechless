import { useState } from 'react';
import { questionsToPlainText } from '../../lib/comparisonScoring.js';
import StatusBadge from './StatusBadge.jsx';

/**
 * Turns every Not Stated / Needs Clarification item into a question the
 * homeowner can actually put to the contractor, grouped by contractor and
 * category so it can be sent as one message.
 */
export default function ContractorQuestions({ packs = [], contractors = [] }) {
  const [built, setBuilt] = useState(false);
  const [activePack, setActivePack] = useState(packs[0]?.contractorId || '');
  const [copiedId, setCopiedId] = useState('');
  const [showAll, setShowAll] = useState(false);

  const totalQuestions = packs.reduce((sum, pack) => sum + pack.total, 0);
  const priorityQuestions = packs.reduce((sum, pack) => sum + (pack.priorityTotal || 0), 0);
  const current = packs.find((pack) => pack.contractorId === activePack) || packs[0];
  const currentContractor = contractors.find((contractor) => contractor.id === current?.contractorId);

  const visibleGroups = (current?.groups || [])
    .map((group) => ({
      ...group,
      questions: showAll ? group.questions : group.questions.filter((question) => question.priority === 'high')
    }))
    .filter((group) => group.questions.length);

  async function copyPack(pack) {
    const text = questionsToPlainText(pack, pack.contractorName, { priorityOnly: !showAll });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(pack.contractorId);
      setTimeout(() => setCopiedId(''), 2500);
    } catch {
      // Clipboard can be blocked by browser permissions — the text stays visible
      // on screen either way, so there is nothing to recover from.
      setCopiedId('');
    }
  }

  if (!packs.length || totalQuestions === 0) return null;

  return (
    <section className="ec-section ec-questions-builder" aria-labelledby="ec-ask-heading">
      <h2 className="ec-section-title" id="ec-ask-heading">
        Ask the contractor
      </h2>
      <p className="mini ec-section-sub">
        We found <strong>{totalQuestions}</strong> item{totalQuestions === 1 ? '' : 's'} across your estimates that are not stated or are
        worded ambiguously. We lead with the <strong>{priorityQuestions}</strong> that carry the most financial or warranty consequence — the
        rest are one click away.
      </p>

      {!built ? (
        <button type="button" className="btn" onClick={() => setBuilt(true)}>
          Create My Contractor Questions
        </button>
      ) : (
        <div className="ec-questions-panel">
          <div className="ec-column-picker" role="tablist" aria-label="Choose a contractor">
            {packs.map((pack) => (
              <button
                key={pack.contractorId}
                type="button"
                role="tab"
                aria-selected={current?.contractorId === pack.contractorId}
                className={`ec-column-tab ${current?.contractorId === pack.contractorId ? 'is-active' : ''}`}
                onClick={() => setActivePack(pack.contractorId)}
              >
                {pack.contractorName} <span className="ec-tab-count">{pack.total}</span>
              </button>
            ))}
          </div>

          {current ? (
            <div className="ec-questions-pack">
              <div className="ec-pack-head">
                <h3 className="ec-subsection-title">
                  {showAll ? current.total : current.priorityTotal} question
                  {(showAll ? current.total : current.priorityTotal) === 1 ? '' : 's'} for {current.contractorName}
                  {showAll ? '' : ' — highest impact first'}
                </h3>
                <div className="ec-pack-actions">
                  <button type="button" className="btn secondary" onClick={() => setShowAll((value) => !value)}>
                    {showAll ? `Show only the ${current.priorityTotal} highest impact` : `Show all ${current.total}`}
                  </button>
                  <button type="button" className="btn secondary" onClick={() => copyPack(current)}>
                    {copiedId === current.contractorId ? 'Copied' : 'Copy these questions'}
                  </button>
                </div>
              </div>

              {currentContractor?.extractionMode && currentContractor.extractionMode !== 'openai' ? (
                <p className="mini ec-summary-note">
                  This estimate could not be fully read, so its question list reflects everything unverified rather than everything missing.
                </p>
              ) : null}

              {visibleGroups.map((group) => (
                <div className="ec-question-group" key={group.categoryId}>
                  <h4 className="ec-question-group-title">{group.categoryLabel}</h4>
                  <ul className="ec-question-list">
                    {group.questions.map((item) => (
                      <li key={item.fieldKey} className={item.priority === 'high' ? 'is-priority' : ''}>
                        <div className="ec-question-meta">
                          <span className="ec-question-field">{item.label}</span>
                          <StatusBadge status={item.status} compact />
                        </div>
                        <p className="ec-question-text">“{item.question}”</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
