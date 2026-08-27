/**
 * Progress indicator for the intake wizard. Steps already completed are
 * clickable so the homeowner can go back and change an answer.
 */
export default function IntakeStepper({ steps = [], currentStep = 0, onStepSelect }) {
  return (
    <ol className="ec-stepper" aria-label="Estimate comparison progress">
      {steps.map((step, index) => {
        const isCurrent = index === currentStep;
        const isComplete = index < currentStep;
        const state = isCurrent ? 'current' : isComplete ? 'complete' : 'upcoming';

        return (
          <li key={step.id} className={`ec-step ec-step-${state}`}>
            <button
              type="button"
              className="ec-step-button"
              onClick={() => (isComplete && onStepSelect ? onStepSelect(index) : undefined)}
              disabled={!isComplete}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="ec-step-num" aria-hidden="true">
                {isComplete ? '✓' : index + 1}
              </span>
              <span className="ec-step-text">
                <span className="ec-step-title">{step.title}</span>
                {step.subtitle ? <span className="ec-step-sub">{step.subtitle}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
