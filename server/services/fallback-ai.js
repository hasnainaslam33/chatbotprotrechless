import { getModuleConfig } from './module-config.js';
import { cleanText } from '../utils/safe.js';


function extractCostEstimateFromInput(text = '', formContext = {}) {
  const direct = formContext?.costEstimate?.label;
  if (direct) return String(direct);
  const asJson = JSON.stringify(formContext || {});
  const combined = `${text}\n${asJson}`;
  const match = combined.match(/(?:Estimated cost|calculated planning range|planning range|rough range)\s*[:\-–]?\s*(\$\s?\d[\d,]*\s*(?:to|-|–)\s*\$\s?\d[\d,]*\+?)/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function stripMarkdown(value = '') {
  return String(value || '')
    .replace(/\*+/g, '')
    .replace(/_+/g, '')
    .replace(/~+/g, '')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatFallback({ urgency = 'Medium', summary = '', causes = '', steps = [], questions = [], cta = '', disclaimer = true }) {
  const cleanSummary = stripMarkdown(summary);
  const cleanCauses = stripMarkdown(causes);
  const cleanSteps = steps.map(stripMarkdown).filter(Boolean);
  const cleanQuestions = questions.map(stripMarkdown).filter(Boolean);
  const cleanCta = stripMarkdown(cta);

  const firstSentenceMatch = cleanSummary.match(/^([^.?!]+[.?!])\s*(.*)$/s);
  const problemHeading = firstSentenceMatch ? firstSentenceMatch[1].trim() : cleanSummary;
  const problemDescription = firstSentenceMatch ? firstSentenceMatch[2].trim() : '';
  const causeBlock = cleanCauses ? `\n\nLikely cause categories:\n${cleanCauses}` : '';
  const stepBlock = cleanSteps.length ? `\n\nRecommended next steps:\n${cleanSteps.map(step => `- ${step}`).join('\n')}` : '';
  const questionBlock = cleanQuestions.length ? `\n\nQuestions to ask or information to gather:\n${cleanQuestions.map(question => `- ${question}`).join('\n')}` : '';
  const ctaBlock = cleanCta ? `\n\nSoft CTA:\n${cleanCta}` : '';
  const disclaimerBlock = disclaimer ? `\n\nDisclaimer:\nThis AI tool provides educational guidance only. Final diagnosis, repair method, pricing, code compliance, permits, and safety decisions require professional inspection and verification.` : '';

  return `Urgency level: ${urgency}\n\nProblem: ${problemHeading}${problemDescription ? `\n\nDescription: ${problemDescription}` : ''}${causeBlock}${stepBlock}${questionBlock}${ctaBlock}${disclaimerBlock}`;
}

function emergencyFallback(text) {
  const lower = text.toLowerCase();
  const emergencySignals = ['sewage', 'overflow', 'multiple fixtures', 'toilet not flushing', 'electrical', 'restaurant', 'tenant', 'closing'];
  const hit = emergencySignals.some((signal) => lower.includes(signal));
  if (hit) {
    return formatFallback({
      urgency: 'Emergency',
      summary: 'Based on what you described, this may be urgent or an emergency, especially if sewage is actively backing up, multiple fixtures are affected, or water is near electrical systems.',
      causes: 'Possible main sewer restriction, active backup, severe blockage, or line condition that needs professional verification.',
      steps: [
        'Stop using water where possible if sewage is active.',
        'Keep people away from contaminated water and avoid electrical risk areas.',
        'Request sewer camera inspection with locate once the line can be safely accessed.',
        'Ask for written findings and Good / Better / Best options before approving major repair work.'
      ],
      cta: 'Request urgent service or a Pro Trenchless second opinion if the situation is active, spreading, or tied to a business/tenant/closing deadline.'
    });
  }
  return null;
}

export function fallbackAnswer({ module, message, userType, formContext = {} }) {
  const moduleInfo = getModuleConfig(module);
  const text = cleanText(message, 4000);
  const emergency = emergencyFallback(text);
  if (emergency) return emergency;

  if (module === 'estimate-review') {
    return formatFallback({
      urgency: 'Medium',
      summary: 'Your estimate should clearly explain what is included, what is excluded, and what was verified by camera before repair work is approved.',
      causes: 'The main risk is not the repair method itself. The risk is an unclear scope, missing footage/depth details, missing restoration notes, or no camera verification.',
      steps: [
        'Confirm pipe footage, pipe material, depth, access point, excavation or trenchless method, backfill, restoration, permits, utility marking, camera verification, warranty, and cleanout details.',
        'Ask whether cleaning, hydro jetting, lining, pipe bursting, spot repair, or replacement was considered based on actual camera findings.',
        'Get a second opinion before approving a full sewer replacement if the estimate is vague, rushed, or missing verification.'
      ],
      questions: [
        'Does the estimate include camera verification and locate?',
        'What exactly changes the price after work starts?',
        'Are Good / Better / Best repair options included?'
      ],
      cta: 'A Pro Trenchless second opinion would make sense if the estimate is vague, expensive, rushed, or does not include camera verification.'
    });
  }

  if (module === 'cost-estimator') {
    const costRange = extractCostEstimateFromInput(text, formContext);
    return formatFallback({
      urgency: 'Scheduled',
      summary: `${costRange ? `Estimated cost: ${costRange}. ` : ''}Sewer cost can only be estimated as a rough planning range until the line is inspected and located. This is not a quote.`,
      causes: 'Price usually changes based on pipe length, depth, surface type, access, pipe material, defect type, permits, restoration, and whether it is emergency or scheduled work.',
      steps: [
        'Start with camera inspection and locate before final pricing.',
        'Confirm pipe length, depth, access, surface type, restoration expectations, and permit needs.',
        'Use the inspection to decide whether cleaning, hydro jetting, spot repair, pipe bursting, lining, or replacement is the right call.'
      ],
      cta: 'Schedule an inspection before using any range as a final price.'
    });
  }

  if (module === 'sewer-camera-review') {
    return formatFallback({
      urgency: 'Medium',
      summary: 'A sewer camera video can show important clues, but the video should be verified by a sewer professional before you approve repair work.',
      causes: 'Possible visible categories can include roots, offset joints, bellies, cracks, heavy scale, grease, failed repairs, foreign objects, or collapsed sections.',
      steps: [
        'Share the pipe material, footage marker, defect location, and whether the line was located.',
        'Confirm depth if known and whether the camera reached the city main or septic connection.',
        'Request a professional review before approving replacement, lining, bursting, or excavation.'
      ],
      questions: [
        'Was flow tested?',
        'Was the defect located above ground?',
        'Did the camera reach the city main or septic connection?'
      ],
      cta: 'Pro Trenchless can review the video context and recommend the next step.'
    });
  }

  return formatFallback({
    urgency: 'Medium',
    summary: `For a ${userType || 'homeowner'}, this sounds like a sewer or drain issue that should be understood before money is spent on repair work.`,
    causes: 'The key question is whether this is a one-time clog, a recurring restriction, or a structural sewer problem.',
    steps: [
      'Document the symptoms and when they happen.',
      'Avoid repeated blind cleanings if the issue keeps returning.',
      'Consider a sewer camera inspection with locate if the issue affects multiple fixtures, smells like sewage, returns after cleaning, or happens when another fixture is used.'
    ],
    cta: `${moduleInfo.primaryCta} would be a reasonable next step if the problem is recurring, unclear, or tied to a transaction or business operation.`
  });
}
