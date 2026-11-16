export const toolPages = [
  {
    slug: 'free-second-opinion',
    title: 'Free Sewer Second Opinion',
    lead: 'Share your contact details, contractor recommendation, and supporting files to get a free sewer second opinion.',
    fields: [
      { label: 'Full name', name: 'full-name', type: 'text' },
      { label: 'Phone number', name: 'phone-number', type: 'tel' },
      { label: 'Email', name: 'email', type: 'email' },
      { label: 'Property Address', name: 'address', type: 'text' },
      { label: 'Contractor recommendation', name: 'contractor-recommendation', type: 'text' },
      {
        label: 'Upload files',
        name: 'upload-files',
        type: 'file',
        multiple: true,
        accept: 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt'
      },
      { label: 'Describe what happened', name: 'describe-what-happened', type: 'textarea' }
    ],
    button: { label: 'Get AI recommendation', variant: 'btn' }
  },
  {
    slug: 'cost-estimator',
    title: 'Sewer Repair Cost Estimator',
    lead: 'Use ranges, not guaranteed prices. Final pricing always needs camera inspection, locate, code and permit review, and professional verification.',
    fields: [
      { label: 'Approximate pipe length in feet', name: 'length', type: 'number', placeholder: 'Example: 60' },
      { label: 'Approximate depth in feet', name: 'depth', type: 'number', placeholder: 'Example: 6' },
      { label: 'Surface type above the line', name: 'surface', type: 'select', options: ['Grass', 'Driveway', 'Sidewalk', 'Street', 'Basement floor'] },
      { label: 'Known defect or concern', name: 'known-defect', type: 'select', options: ['Unknown', 'Roots', 'Offset joint', 'Belly', 'Broken pipe', 'Collapsed pipe', 'Heavy scale', 'Grease', 'Poor pitch'] }
    ],
    expectedOutput: [],
    button: { label: 'Get AI cost estimate', variant: 'btn', actionName: 'runCostEstimator' }
  },
  {
    slug: 'emergency-risk-check',
    title: 'Emergency Sewer Backup Risk Check',
    lead: 'Use this when there is active sewage, multiple fixtures backing up, water near electrical systems, restaurant shutdown risk, or a tenant habitability concern.',
    fields: [
      {
        label: 'What is happening right now?',
        name: 'emergency',
        type: 'checkboxGroup',
        optionGroups: [
          {
            label: 'Drainage and plumbing symptoms',
            options: [
              'One slow fixture',
              'Recurring slow drainage',
              'Gurgling drains or pipes',
              'Toilets not flushing',
              'Multiple fixtures backing up',
              'Sewage smell or intermittent odor'
            ]
          },
          {
            label: 'Sewage and emergency conditions',
            options: [
              'Sewage actively entering occupied home or business',
              'Active overflow from outside cleanout',
              'Rapid or uncontrolled sewage overflow',
              'Water or sewage near electrical systems',
              'No functioning sanitation'
            ]
          },
          {
            label: 'Property and business impact',
            options: [
              'Multiple occupied units affected',
              'Tenant habitability issue',
              'Restaurant kitchen shutdown risk',
              'Real estate closing deadline',
              'Immediate health or property-damage risk'
            ]
          },
          {
            label: 'Previous plumbing history',
            options: [
              'Prior root intrusion or root-related issues',
              'Repeated drain cleaning history',
              'Previous sewage backups'
            ]
          }
        ]
      }
    ],
    expectedOutput: [],
    button: { label: 'Get AI emergency guidance', variant: 'btn warn', actionName: 'runEmergencyCheck' }
  },
  {
    slug: 'estimate-review',
    // Rendered by GuidedEstimateTool instead of the generic ToolForm.
    component: 'estimate-comparison',
    fullWidth: true,
    title: 'Three-Quote Sewer Estimate Comparison Tool',
    lead: 'Upload up to three contractor estimates and see exactly what each one covers, excludes, and leaves unsaid — every quote scored against the same criteria.',
    fields: [],
    expectedOutput: [],
    button: {
      label: 'Analyze My Estimates',
      variant: 'btn',
      actionName: 'runEstimateComparison',
      panelHeading: 'Guided estimate comparison',
      panelSubheading:
        'Three estimates give the clearest picture, but one is enough to start. Nothing is assumed — if a contractor did not write it down, it is reported as not stated.'
    }
  },
  {
    slug: 'home-inspector-support',
    title: 'Repair Option Explainer',
    lead: 'Tell us about your sewer problem. Our AI will help you understand potential repair methods, their costs, benefits and limitations.',
    fields: [
      {
        label: '1. What problem are you experiencing?',
        name: 'problem',
        type: 'select',
        options: [
          'Recurring sewer backups',
          'Slow drains or repeated clogs',
          'Sewage smell or odor',
          'Pipe damage or leakage',
          'Collapsed or broken sewer pipe',
          'Tree root intrusion',
          'Old or deteriorating sewer line',
          'I am exploring repair options before a problem occurs',
          'Other / Not sure'
        ]
      },
      {
        label: '2. Where is the problem located?',
        name: 'location',
        type: 'select',
        options: [
          'Underground sewer line',
          'Inside the building / basement',
          'House trap',
          'Main sewer stack',
          'Outside cleanout',
          'Under driveway or yard',
          'Not sure'
        ]
      },
      {
        label: '3. What symptoms have you noticed? (Select all that apply)',
        name: 'symptoms',
        type: 'checkboxGroup',
        options: [
          'Multiple fixtures backing up',
          'Slow drainage',
          'Gurgling sounds',
          'Sewage odor',
          'Water leakage',
          'Repeated blockages',
          'No visible symptoms',
          'Other'
        ]
      },
      {
        label: '4. Has a sewer camera inspection been performed?',
        name: 'inspection',
        type: 'select',
        options: [
          'Yes, I have an inspection report',
          "Yes, but I don't have the report",
          'No, inspection not performed',
          'Not sure'
        ]
      },
      {
        label: '5. What is the known condition of the pipe?',
        name: 'pipe-condition',
        type: 'select',
        options: [
          'Cracked or leaking',
          'Root intrusion',
          'Heavy scale or buildup',
          'Misaligned joints',
          'Partially collapsed',
          'Completely collapsed',
          'Pipe is structurally sound',
          'Not sure'
        ]
      },
      {
        label: '6. What type of pipe do you have?',
        name: 'pipe-type',
        type: 'select',
        options: ['Cast iron', 'Clay', 'PVC / Plastic', 'Concrete', 'Orangeburg', 'Other', 'Not sure']
      },
      {
        label: '7. What access is available to the sewer line?',
        name: 'access',
        type: 'select',
        options: ['Indoor cleanout', 'Outdoor cleanout', 'Basement access', 'Manhole access', 'No known access', 'Not sure']
      },
      {
        label: '8. What is above or around the affected sewer line?',
        name: 'surface',
        type: 'select',
        options: [
          'Driveway',
          'Landscaped yard',
          'Concrete / Patio',
          'Building foundation',
          'Inside finished flooring',
          'Street / Sidewalk',
          'Not sure'
        ]
      },
      {
        label: '9. What would you like help with?',
        name: 'repair-guidance',
        type: 'select',
        options: [
          'Understand all possible repair options',
          'Compare trenchless and traditional excavation',
          'Understand repair costs and disruption',
          'Find out whether pipe lining may be an option',
          'Understand whether replacement is necessary',
          'Get a second opinion on an existing repair recommendation'
        ]
      },
      {
        label: '10. Additional information (optional)',
        name: 'additional-information',
        type: 'textarea',
        placeholder: 'Share any other details that may help explain your sewer problem.'
      },
      { label: 'Your information', type: 'sectionHeading' },
      { label: 'Full name', name: 'full-name', type: 'text' },
      { label: 'Email', name: 'email', type: 'email' },
      { label: 'Phone number', name: 'phone-number', type: 'tel' }
    ],
    button: {
      label: 'Explain my repair options',
      variant: 'btn',
      panelHeading: 'Repair Option Assessment',
      panelSubheading: 'Answer what you can. Your assessment will explain possible methods, costs, benefits, and limitations.'
    }
  },
  {
    slug: 'property-manager-drain-triage',
    title: 'Property Manager Drain Triage',
    lead: 'Use this to sort tenant reports into scheduled, urgent, or emergency service and document the next best step.',
    fields: [
      { label: 'Tenant complaint', type: 'text' },
      { label: 'Unit or property address', type: 'text' },
      { label: 'Fixtures affected', type: 'text' },
      { label: 'Frequency', type: 'text' },
      { label: 'Any sewage smell', type: 'text' },
      { label: 'Photos or video', type: 'text' },
      { label: 'Prior service history', type: 'text' },
      { label: 'Upload files', type: 'file' },
      { label: 'Describe what happened', type: 'textarea' }
    ],
    button: { label: 'Get AI recommendation', variant: 'btn' }
  },
  {
    slug: 'realtor-sewer-risk-tool',
    title: 'Realtor Sewer Risk Tool',
    lead: 'Use this when a sewer scope finding, vague estimate, or surprise backup could affect negotiations, timelines, or buyer confidence.',
    fields: [
      { label: 'Property address', type: 'text' },
      { label: 'Closing timeline', type: 'text' },
      { label: 'Inspection report', type: 'text' },
      { label: 'Camera footage', type: 'text' },
      { label: 'Known defect', type: 'text' },
      { label: 'Seller repair estimate', type: 'text' },
      { label: 'Buyer concern', type: 'text' },
      { label: 'Upload files', type: 'file' },
      { label: 'Describe what happened', type: 'textarea' }
    ],
    expectedOutput: ['Risk level', 'Transaction protection next step', 'Questions for seller or contractor', 'Inspection scheduling recommendation'],
    button: { label: 'Get AI recommendation', variant: 'btn' }
  },
  {
    slug: 'repair-options',
    title: 'Sewer Repair Option Explainer',
    lead: 'Use this page as an educational hub that helps people understand cost, disruption, longevity, risk, surface impact, best use case, and when an option is not recommended.',
    fields: [
      { label: 'Problem type', type: 'text' },
      { label: 'Known defect', type: 'text' },
      { label: 'Pipe material', type: 'text' },
      { label: 'Surface impact concern', type: 'text' },
      { label: 'Repair already recommended', type: 'text' },
      { label: 'Budget concern', type: 'text' },
      { label: 'Timeline', type: 'text' },
      { label: 'Upload files', type: 'file' },
      { label: 'Describe what happened', type: 'textarea' }
    ],
    expectedOutput: ['Option comparison', 'Best use case', 'When not recommended', 'Main-site service page link'],
    button: { label: 'Get AI recommendation', variant: 'btn' }
  },
  {
    slug: 'restaurant-grease-line-risk',
    title: 'Restaurant Grease Line Risk Tool',
    lead: 'Use this when a restaurant kitchen drain is slowing down, backing up, smelling, or creating shutdown risk.',
    fields: [
      { label: 'Affected drain', type: 'text' },
      { label: 'Time of day issue happens', type: 'text' },
      { label: 'Grease trap status', type: 'text' },
      { label: 'Prior cleaning schedule', type: 'text' },
      { label: 'Shutdown risk', type: 'text' },
      { label: 'Photos or video', type: 'text' },
      { label: 'Emergency need', type: 'text' },
      { label: 'Upload files', type: 'file' },
      { label: 'Describe what happened', type: 'textarea' }
    ],
    expectedOutput: ['Grease-line risk', 'Cleaning or jetting recommendation', 'Shutdown prevention note', 'Service booking CTA'],
    button: { label: 'Get AI recommendation', variant: 'btn' }
  },
  {
    slug: 'sewer-camera-review',
    title: 'Sewer Camera Video Review Intake',
    lead: 'Upload your sewer camera video and contact details to request a written review. Your phone number is optional.',
    fields: [
      { label: 'Name', name: 'name', type: 'text', placeholder: 'Your full name', required: true, autoComplete: 'name' },
      { label: 'Address', name: 'address', type: 'text', placeholder: 'Property address', required: true, autoComplete: 'street-address' },
      { label: 'Email for written report', name: 'email', type: 'email', placeholder: 'you@example.com', required: true, autoComplete: 'email' },
      { label: 'Phone number (optional)', name: 'phone', type: 'tel', placeholder: 'Best phone number', autoComplete: 'tel' },
      { label: 'Upload sewer camera video', name: 'camera-video', type: 'file', accept: 'video/*', required: true }
    ],
    button: { label: 'Request written review', panelHeading: 'Get a written camera review', variant: 'btn' }
  },
  {
    slug: 'symptom-checker',
    title: 'Sewer Symptom Checker',
    lead: 'Answer a few plain-English questions about the backup, odor, rain, trees, prior cleaning, and fixtures involved.',
    fields: [
      {
        label: 'What is backing up?',
        name: 'fixture',
        type: 'checkboxGroup',
        options: [
          'Basement drain',
          'Toilet',
          'Shower',
          'Kitchen sink',
          'Laundry',
          'Outside cleanout',
          'Multiple fixtures'
        ]
      },
      { label: 'How often does it happen?', name: 'repeat', type: 'select', options: ['One time', 'Comes and goes', 'Keeps coming back', 'Every time water is used'] },
      {
        label: 'Warning signs',
        name: 'signal',
        type: 'checkboxGroup',
        options: [
          'Sewage smell',
          'Water comes up from another fixture',
          'Recent heavy rain',
          'Large trees nearby',
          'Prior repeated cleanings',
          'Real estate transaction'
        ]
      },
      { label: 'Known pipe material', type: 'select', options: ['Unknown', 'Clay', 'Cast iron', 'PVC', 'Terra cotta', 'Orangeburg'] }
    ],
    expectedOutput: [],
    button: { label: 'Get AI risk recommendation', variant: 'btn', actionName: 'runSymptomChecker' }
  },
  {
    slug: 'commercial-property-review',
    title: 'Commercial Sewer Risk Review',
    lead: 'Use this for recurring commercial sewer issues, tenant disruption, restaurant risk, or property sale due diligence.',
    fields: [
      { label: 'Property type', type: 'text' },
      { label: 'Issue frequency', type: 'text' },
      { label: 'Affected areas', type: 'text' },
      { label: 'Business impact', type: 'text' },
      { label: 'Known pipe material', type: 'text' },
      { label: 'Prior camera inspection', type: 'text' },
      { label: 'Budget or deadline', type: 'text' },
      { label: 'Upload files', type: 'file' },
      { label: 'Describe what happened', type: 'textarea' }
    ],
    expectedOutput: ['Risk review', 'Repair planning recommendation', 'Budget range flag', 'Priority scheduling CTA'],
    button: { label: 'Get AI recommendation', variant: 'btn' }
  }
];
