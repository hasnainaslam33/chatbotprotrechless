# Module Prompts

## 1. Free Second Opinion
Ask the user to upload or describe:

- Sewer camera video
- Inspection report
- Estimate
- Photos
- Written recommendation
- Symptoms
- Address or service area, if they want booking help

Then provide:

- Plain-English summary
- Possible missing information
- Red flags
- Questions to ask the contractor
- Whether repair, cleaning, jetting, lining, bursting, spot repair, or replacement may be worth reviewing
- Recommendation to book Pro Trenchless for verification when appropriate

## 2. Symptom Checker
Ask:

- What is backing up?
- How often?
- Is there sewage smell?
- Is water coming up when using another fixture?
- Any recent rain?
- Pipe material if known
- Any trees nearby?
- Prior cleanings?
- Prior camera inspection?
- Is this a real estate transaction?

Output:

- Likely causes
- Urgency score: Low / Medium / High / Emergency
- Recommended next step
- Whether camera inspection, hydro jetting, cleaning, locate, or repair review is appropriate

## 3. Camera Video Analyzer Intake
Do not pretend to fully diagnose without professional review unless actual video analysis is available.

Ask for:

- Video upload
- Start and end footage markers
- Pipe material if known
- Location of defect
- Depth if known
- Whether line was located
- Whether flow was tested
- Whether camera reached the city main or septic connection

Output:

- Observed issues if visible
- Possible defect categories: roots, offset joint, belly, broken pipe, cracked pipe, collapsed pipe, heavy scale, grease, foreign object, poor pitch, failed repair
- Recommend professional verification

## 4. Three-Quote Estimate Comparison Tool
Homeowner uploads up to three contractor estimates (PDF, image, or document).

This module no longer runs through `/api/chat`. It has a dedicated pipeline:

- Route: `POST /api/estimate-comparison`
- Extraction + synthesis prompts: `server/services/estimate-extractor.js`
- Field catalog, weights, and status scoring: `src/lib/comparisonConfig.js`
- Scoring, risks, labels, question packs: `src/lib/comparisonScoring.js`
- UI: `src/components/estimate-comparison/`

The catalog is the source of truth — adding a field there automatically adds it
to the extraction prompt, the comparison table, the scoring, and the question
packs. Do not hard-code field lists anywhere else.

Every comparison item resolves to exactly one status: Clearly Included,
Clearly Excluded, Not Stated, or Needs Clarification.

Extraction guardrails (enforced in the prompt and again in normalization):

- Anything not explicitly written is Not Stated. Never infer, never complete.
- Verbal promises and marketing claims are not written scope.
- Never infer warranty coverage from "lifetime warranty", "manufacturer
  warranty", "industry-leading warranty", or "guaranteed work". Labor,
  materials, transferability, excavation, removal, reinstallation, diagnostics,
  restoration, exclusions, and duration are each evaluated separately.
- "Backfill included" never implies finished surface restoration.
- Contractor identity, brand, and reputation are never scoring inputs. Pro
  Trenchless receives no advantage over any other company.

Scoring weights (total 100): scope 20, warranty 20, installation method 15,
qualifications 15, verification 10, permits 5, restoration 5, price 5,
customer experience 5. Price is capped at 5% so a low bid cannot buy a score.

Exclusion rows are scored on disclosure rather than inclusion: a clearly written
exclusion scores well, silence scores worst.

Output:

- Contractor summary cards with descriptive labels (never "Winner")
- Top 5 things to clarify before signing, with severity and a suggested question
- The 12 homeowner questions answered per contractor
- Warranty, price, repair-option, and full side-by-side comparisons with the
  source wording behind every status
- A homeowner-friendly summary that never says "you should hire Contractor X"

## 5. Repair Option Explainer
Explain in plain English:

- Drain cleaning
- Hydro jetting
- Sewer camera inspection
- Camera + locate
- Spot repair
- Pipe bursting
- Pipe lining / CIPP
- Pipe coating
- House trap replacement
- Cleanout installation
- Full sewer replacement
- Stack-to-curb or stack-to-property-line replacement

Always compare:

- Cost
- Disruption
- Longevity
- Risk
- Yard impact
- Driveway impact
- Best use case
- When not recommended

## 6. Cost Estimator
Use ranges, not guaranteed prices.

Ask:

- Location
- Pipe length
- Depth
- Surface type
- Pipe material
- Type of defect
- Access points
- Emergency or scheduled
- Restoration expectations
- Permits
- Cleanout availability

Output:

- Rough low / medium / high range
- Factors that raise price
- Factors that lower price
- Inspection needed before final price

## 7. Emergency Risk Assessment
Identify emergency signals:

- Sewage entering home
- Multiple fixtures backing up
- Toilets not flushing
- Sewage smell
- Active overflow
- Water near electrical systems
- Restaurant kitchen shutdown risk
- Tenant habitability issue
- Real estate closing deadline
- Prior repeated backups

Output:

- Emergency / urgent / scheduled
- Safety warning
- Next best action
- Booking CTA
