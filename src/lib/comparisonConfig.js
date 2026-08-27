/**
 * Single source of truth for the Three-Quote Sewer Estimate Comparison Tool.
 *
 * This module is imported by BOTH the React UI (src/components/estimate-comparison/*)
 * and the Node backend (server/services/estimate-extractor.js). It must stay plain
 * ESM JavaScript with no JSX, no browser globals, and no node globals.
 *
 * Everything the tool renders — intake fields, comparison rows, category accordions,
 * score weights, homeowner questions — is driven from the data below. Add a field here
 * and it automatically appears in the AI extraction prompt, the comparison table, the
 * scoring, and the "Ask the contractor" question list.
 */

/* ------------------------------------------------------------------ */
/* Status model                                                        */
/* ------------------------------------------------------------------ */

export const STATUS = {
  INCLUDED: 'clearly_included',
  EXCLUDED: 'clearly_excluded',
  NOT_STATED: 'not_stated',
  NEEDS_CLARIFICATION: 'needs_clarification'
};

export const statusMeta = {
  [STATUS.INCLUDED]: {
    label: 'Clearly Included',
    shortLabel: 'Included',
    icon: '✓',
    tone: 'positive',
    description: 'The written estimate explicitly confirms this is part of the quoted scope.'
  },
  [STATUS.EXCLUDED]: {
    label: 'Clearly Excluded',
    shortLabel: 'Excluded',
    icon: '✕',
    tone: 'negative',
    description: 'The written estimate explicitly says this is not included or costs extra.'
  },
  [STATUS.NOT_STATED]: {
    label: 'Not Stated',
    shortLabel: 'Not stated',
    icon: '—',
    tone: 'neutral',
    description: 'The estimate says nothing either way. Do not assume it is included.'
  },
  [STATUS.NEEDS_CLARIFICATION]: {
    label: 'Needs Clarification',
    shortLabel: 'Unclear',
    icon: '?',
    tone: 'warning',
    description: 'The wording is ambiguous and could be read more than one way.'
  }
};

export const allStatuses = [STATUS.INCLUDED, STATUS.EXCLUDED, STATUS.NOT_STATED, STATUS.NEEDS_CLARIFICATION];

export function isStatus(value) {
  return allStatuses.includes(value);
}

/* ------------------------------------------------------------------ */
/* Status scoring configuration (never hard-code these in components)  */
/* ------------------------------------------------------------------ */

/**
 * Completeness scoring: "is this actually covered by the quoted price?"
 * A clearly disclosed exclusion still means the homeowner pays for it separately.
 */
export const completenessStatusScores = {
  [STATUS.INCLUDED]: 1.0,
  [STATUS.NEEDS_CLARIFICATION]: 0.4,
  [STATUS.NOT_STATED]: 0.2,
  [STATUS.EXCLUDED]: 0
};

/**
 * Transparency scoring: "did the contractor put this in writing at all?"
 * Used for exclusion-style rows, where a clearly disclosed exclusion is honest
 * disclosure and scores far better than silence that turns into a surprise bill.
 */
export const transparencyStatusScores = {
  [STATUS.INCLUDED]: 1.0,
  [STATUS.EXCLUDED]: 0.85,
  [STATUS.NEEDS_CLARIFICATION]: 0.4,
  [STATUS.NOT_STATED]: 0
};

export function scoreForStatus(status, { transparency = false } = {}) {
  const table = transparency ? transparencyStatusScores : completenessStatusScores;
  const value = table[status];
  return typeof value === 'number' ? value : table[STATUS.NOT_STATED];
}

/* ------------------------------------------------------------------ */
/* Weighted score groups — must total 100                              */
/* ------------------------------------------------------------------ */

export const scoreGroups = [
  { id: 'scope', label: 'Scope clarity & completeness', weight: 20 },
  { id: 'method', label: 'Installation method & specifications', weight: 15 },
  { id: 'warranty', label: 'Warranty protection', weight: 20 },
  { id: 'qualifications', label: 'Contractor qualifications & accountability', weight: 15 },
  { id: 'verification', label: 'Camera documentation & quality verification', weight: 10 },
  { id: 'permits', label: 'Permits, utilities & code compliance', weight: 5 },
  { id: 'restoration', label: 'Excavation & restoration clarity', weight: 5 },
  { id: 'price', label: 'Price transparency', weight: 5 },
  { id: 'customer', label: 'Customer communication & satisfaction protections', weight: 5 }
];

export const scoreGroupById = Object.fromEntries(scoreGroups.map((group) => [group.id, group]));

/* ------------------------------------------------------------------ */
/* Field helper                                                        */
/* ------------------------------------------------------------------ */

/**
 * @param {string} key         stable snake_case identifier used by the AI + scoring
 * @param {string} label       homeowner-facing row label
 * @param {object} [extra]     { q, group, transparency, highlight, hint }
 *   q            - homeowner-friendly clarification question ("Ask the contractor")
 *   group        - score group override (defaults to the category's group)
 *   transparency - score this row on disclosure rather than inclusion
 *   highlight    - render prominently in the comparison table
 *   hint         - short tooltip explaining why the row matters
 */
function f(key, label, extra = {}) {
  return { key, label, ...extra };
}

/* ------------------------------------------------------------------ */
/* Comparison categories                                               */
/* ------------------------------------------------------------------ */

export const comparisonCategories = [
  {
    id: 'contractor',
    label: 'Contractor & Accountability',
    group: 'qualifications',
    intro: 'Who is legally standing behind this work, and are they the company that will actually be in your yard?',
    fields: [
      f('legal_business_name', 'Legal business name', { q: 'What is the exact legal business name that will appear on the contract?' }),
      f('business_address', 'Business address', { q: 'What is your physical business address?' }),
      f('license_number', 'Contractor / license / registration number', { q: 'What is your contractor license or registration number for this type of sewer work?' }),
      f('master_plumber_oversight', 'Master plumber oversight', { q: 'Is a master plumber overseeing this project, and is that in writing?' }),
      f('general_liability_insurance', 'General liability insurance', { q: 'Can you provide a certificate of general liability insurance naming this project?' }),
      f('workers_comp_insurance', "Workers' compensation insurance", { q: "Do you carry workers' compensation insurance for every person who will be on my property?" }),
      f('years_experience', 'Years of relevant experience', { q: 'How many years have you been performing this specific sewer repair method?' }),
      f('manufacturer_certifications', 'Manufacturer certifications', { q: 'Which manufacturer certifications does your company hold for the product you are installing?' }),
      f('trenchless_certifications', 'Trenchless installation certifications', { q: 'Are your installers certified for trenchless installation, and by whom?' }),
      f('employees_or_subs', 'Employees or subcontractors performing the work', {
        q: 'Will your own employees perform the installation, or will any part of the work be subcontracted?',
        highlight: true,
        hint: 'Subcontracted work is common and fine — but responsibility must be written down.'
      }),
      f('subcontractor_company_identified', 'Subcontractor company identified', { q: 'If any work is subcontracted, which company will perform it?' }),
      f('subcontractor_licensing', 'Subcontractor licensing', { q: 'Is the subcontractor separately licensed for this work?' }),
      f('subcontractor_insurance', 'Subcontractor insurance', { q: 'Does the subcontractor carry its own liability and workers compensation insurance?' }),
      f('subcontractor_workmanship_responsibility', 'Who is legally responsible for subcontractor workmanship', {
        q: 'If a subcontractor causes a defect, which company is legally responsible to me — yours or theirs?',
        highlight: true
      }),
      f('warranty_claim_handler', 'Who handles warranty claims', { q: 'If I have a warranty claim in five years, who do I call and which company pays for it?' }),
      f('installer_matches_named_contractor', 'Installing contractor is the contractor named on the estimate', {
        q: 'Is the company named on this estimate the same company that will physically perform the installation?',
        highlight: true
      })
    ]
  },

  {
    id: 'existing-condition',
    label: 'Existing Pipe Condition',
    group: 'verification',
    intro: 'A repair recommendation is only as good as the documentation of the pipe it is based on.',
    fields: [
      f('pre_install_camera_inspection', 'Pre-installation camera inspection included', { q: 'Is a camera inspection of the existing line included before work begins?' }),
      f('camera_inspection_performed', 'Camera inspection already performed', { q: 'Has a camera inspection already been performed on my line?' }),
      f('camera_video_provided', 'Camera video provided to homeowner', { q: 'Will I receive a copy of the camera video file, not just a verbal description?' }),
      f('pipe_footage_documented', 'Pipe footage documented', { q: 'What exact footage of pipe did the camera document, from where to where?' }),
      f('pipe_diameter_documented', 'Pipe diameter documented', { q: 'What is the documented diameter of the existing pipe?' }),
      f('pipe_material_documented', 'Pipe material documented', { q: 'What is the documented material of the existing pipe?' }),
      f('pipe_depth_documented', 'Pipe depth documented', { q: 'What is the documented depth of the line, and how was that depth confirmed?' }),
      f('pipe_route_documented', 'Pipe route documented', { q: 'Was the line located and its route mapped across the property?' }),
      f('existing_access_points', 'Existing access points documented', { q: 'Which access points were used to inspect the line?' }),
      f('existing_cleanouts', 'Existing cleanouts documented', { q: 'Does my property currently have cleanouts, and what condition are they in?' }),
      f('municipal_connection_documented', 'Municipal / sewer connection documented', { q: 'Did the camera reach the municipal main or septic connection?' }),
      f('root_intrusion_documented', 'Root intrusion documented', { q: 'Was root intrusion observed, and at what footage?' }),
      f('cracks_documented', 'Cracks documented', { q: 'Were cracks observed, and at what footage?' }),
      f('offsets_documented', 'Offset joints documented', { q: 'Were offset joints observed, and at what footage?' }),
      f('bellies_documented', 'Pipe bellies documented', { q: 'Was a belly or low spot observed, and how long is it?' }),
      f('corrosion_documented', 'Corrosion documented', { q: 'Was corrosion observed in the existing pipe?' }),
      f('scaling_documented', 'Scaling documented', { q: 'Was scale buildup observed, and how heavy is it?' }),
      f('infiltration_documented', 'Infiltration documented', { q: 'Was groundwater infiltration observed entering the pipe?' }),
      f('collapse_documented', 'Collapse documented', { q: 'Was any section of the pipe collapsed or fully blocked?' }),
      f('other_structural_defects', 'Other structural defects documented', { q: 'Were any other structural defects found in the line?' }),
      f('existing_pipe_suitable_for_method', 'Existing pipe considered suitable for the proposed repair', {
        q: 'Is the existing pipe structurally suitable for the repair method you are proposing? What confirms that?',
        highlight: true
      }),
      f('method_selection_explained', 'Contractor explains why this repair method was selected', {
        q: 'Why did you select this repair method over the alternatives for my specific documented pipe condition?',
        highlight: true
      })
    ]
  },

  {
    id: 'proposed-work',
    label: 'Proposed Work & Scope',
    group: 'scope',
    intro: 'What is actually being installed, over how much pipe, and using which product.',
    fields: [
      f('repair_method', 'Proposed repair method', { q: 'Which repair method is quoted here: lining, bursting, coating, excavation, spot repair, or full replacement?', highlight: true }),
      f('total_footage_repaired', 'Total footage being repaired', { q: 'Exactly how many feet of pipe does this price cover?', highlight: true }),
      f('proposed_pipe_diameter', 'Pipe diameter being installed', { q: 'What diameter will the finished pipe or liner be?' }),
      f('new_pipe_material', 'New pipe / liner material', { group: 'method', q: 'What material is the new pipe or liner?' }),
      f('liner_type', 'Liner type', { group: 'method', q: 'What type of liner is being installed?' }),
      f('resin_type', 'Resin / epoxy type', { group: 'method', q: 'Which resin or epoxy system will be used?' }),
      f('product_manufacturer', 'Product manufacturer', { group: 'method', q: 'Who manufactures the product being installed?' }),
      f('product_system_name', 'Product / system name', { group: 'method', q: 'What is the product or system name, so I can look up its specifications?' }),
      f('liner_thickness', 'Liner or coating thickness', { group: 'method', q: 'What is the specified liner or coating thickness in millimeters or inches?' }),
      f('cure_method', 'Cure method', { group: 'method', q: 'How will the liner be cured: ambient, hot water, steam, or UV?' }),
      f('access_points_used', 'Access points used', { q: 'Which access points will be used to perform the work?' }),
      f('excavation_locations', 'Excavation locations identified', { q: 'Exactly where on my property will you excavate?' }),
      f('number_of_excavations', 'Number of excavations', { q: 'How many separate excavation pits does this price include?' }),
      f('connections_included', 'Connections included', { q: 'Are all pipe connections included in this price?' }),
      f('branch_lines_included', 'Branch lines included', { q: 'Are branch lines or secondary laterals included, or only the main run?' }),
      f('lateral_reinstatement', 'Reinstatement of lateral connections', { q: 'After lining, how will branch connections be reopened, and is that included?' }),
      f('bypass_pumping', 'Bypass pumping', { q: 'Is bypass pumping included if the line must stay in service?' }),
      f('sewer_cleaning', 'Sewer cleaning', { q: 'Is cleaning the line before the repair included in this price?' }),
      f('hydro_jetting', 'Hydro jetting', { q: 'Is hydro jetting included, or billed separately?' }),
      f('mechanical_descaling', 'Mechanical descaling', { q: 'Is mechanical descaling included if the pipe has heavy scale?' }),
      f('root_removal', 'Root removal', { q: 'Is root removal included in this price?' }),
      f('debris_disposal', 'Debris disposal', { q: 'Is hauling away debris and spoils included?' }),
      f('cleanup', 'Cleanup', { q: 'Is site cleanup included, and what does "cleanup" mean in your scope?' }),
      f('temporary_plumbing', 'Temporary plumbing arrangements', { q: 'If my sewer is out of service, what temporary arrangements are included?' })
    ]
  },

  {
    id: 'excavation-restoration',
    label: 'Excavation & Restoration',
    group: 'restoration',
    intro:
      'Backfill is not restoration. Backfill puts the dirt back; restoration puts the driveway, concrete, or lawn back. These are scored separately on purpose.',
    fields: [
      f('excavation_included', 'Excavation included', { q: 'Is all required excavation included in the quoted price?' }),
      f('backfill_included', 'Backfill included', { q: 'Is backfill included?', hint: 'Backfill alone does not mean your surface is put back.' }),
      f('compaction_included', 'Compaction included', { q: 'Is proper compaction of the backfill included, so the ground does not sink later?' }),
      f('spoils_removal', 'Spoils removal included', { q: 'Is removal of excavated soil from my property included?' }),
      f('rock_excavation_included', 'Rock excavation included', { q: 'If you hit rock, is that included in this price or charged extra?' }),
      f('groundwater_handling', 'Groundwater handling included', { q: 'If the excavation fills with groundwater, is dewatering included or extra?' }),
      f('shoring_included', 'Shoring included', { q: 'Is trench shoring or shielding included where depth requires it?' }),
      f('topsoil_replacement', 'Topsoil replacement', { q: 'Is replacement topsoil included?' }),
      f('grass_restoration', 'Grass restoration', { q: 'Will grass be restored, and by seed or sod?' }),
      f('sod_restoration', 'Sod restoration', { q: 'Is sod included, or only seed?' }),
      f('landscaping_restoration', 'Landscaping restoration', { q: 'Are plants, beds, and landscaping restored, or is that my responsibility?' }),
      f('concrete_restoration', 'Concrete restoration', {
        q: 'Does your quoted price include restoring the concrete after the sewer work is complete?',
        highlight: true
      }),
      f('asphalt_restoration', 'Asphalt restoration', { q: 'Does your quoted price include restoring the asphalt?', highlight: true }),
      f('paver_restoration', 'Paver restoration', { q: 'Will pavers be lifted, stored, and reset, and is that included?' }),
      f('driveway_restoration', 'Driveway restoration', {
        q: 'Does your quoted price include restoring the driveway after the sewer work is complete?',
        highlight: true
      }),
      f('sidewalk_restoration', 'Sidewalk restoration', { q: 'Is sidewalk restoration included, and does it meet municipal standards?' }),
      f('patio_restoration', 'Patio restoration', { q: 'Is patio restoration included?' }),
      f('basement_floor_restoration', 'Basement floor restoration', { q: 'If the basement floor is cut, is patching the concrete floor included?' }),
      f('interior_finish_restoration', 'Drywall / interior finish restoration', { q: 'If interior finishes are removed, who restores drywall, paint, and flooring?' }),
      f('final_grading', 'Final grading', { q: 'Is final grading included so water drains away from the house?' }),
      f('restoration_warranty', 'Restoration warranty stated in scope', { q: 'Is the restoration work itself warrantied, and for how long?' })
    ]
  },

  {
    id: 'cleanouts',
    label: 'Cleanouts & Access',
    group: 'scope',
    intro: 'Cleanouts determine how easy — and how expensive — every future service call will be.',
    fields: [
      f('existing_cleanout_condition', 'Existing cleanout condition documented', { q: 'What condition are my existing cleanouts in?' }),
      f('new_cleanout_included', 'New cleanout included', { q: 'Is a new cleanout included in this price?' }),
      f('cleanout_count', 'Number of cleanouts', { q: 'How many cleanouts does this price include?' }),
      f('cleanout_diameter', 'Cleanout diameter', { q: 'What diameter will the cleanout be?' }),
      f('cleanout_material', 'Cleanout material', { q: 'What material is the cleanout assembly?' }),
      f('cleanout_location', 'Cleanout location', { q: 'Exactly where will the cleanout be installed?' }),
      f('interior_cleanout', 'Interior cleanout', { q: 'Is an interior cleanout included?' }),
      f('exterior_cleanout', 'Exterior cleanout', { q: 'Is an exterior cleanout included?' }),
      f('two_way_cleanout', 'Two-way cleanout', { q: 'Is the cleanout a two-way cleanout that allows camera access in both directions?' }),
      f('cleanout_riser', 'Riser included', { q: 'Is a riser to grade included?' }),
      f('cleanout_cap', 'Cap included', { q: 'Is a proper cap included?' }),
      f('frost_protection', 'Frost protection', { q: 'Is the cleanout protected against frost heave?' }),
      f('traffic_rated_cover', 'Traffic-rated cover', { q: 'If the cleanout is in a driveway, is a traffic-rated cover included?' }),
      f('future_accessibility', 'Future accessibility', { q: 'Will the cleanout remain accessible for future camera inspections and cleaning?' }),
      f('cleanout_restoration', 'Cleanout area restoration', { q: 'Is the surface around the new cleanout restored?' }),
      f('cleanout_warranty', 'Cleanout warranty', { q: 'Is the cleanout installation warrantied separately?' })
    ]
  },

  {
    id: 'permits',
    label: 'Permits, Utilities & Code Compliance',
    group: 'permits',
    intro: 'Permit and utility-locating gaps are one of the most common sources of unexpected cost and delay.',
    fields: [
      f('plumbing_permit', 'Plumbing permit', { q: 'Is the plumbing permit included in this price?' }),
      f('excavation_permit', 'Excavation permit', { q: 'Is an excavation permit required, and is it included?' }),
      f('street_permit', 'Street / highway permit', { q: 'If work reaches the street, is that permit included?' }),
      f('permit_fees', 'Permit fees', { q: 'Are permit fees included in the quoted price or billed to me at cost?' }),
      f('inspection_fees', 'Inspection fees', { q: 'Are municipal inspection fees included?' }),
      f('who_obtains_permits', 'Who obtains permits', { q: 'Who is responsible for pulling the permits — you or me?' }),
      f('plumbing_inspection', 'Plumbing inspection', { q: 'Will a municipal plumbing inspection be performed?' }),
      f('final_inspection', 'Final municipal inspection', { q: 'Is a final inspection included before the job is closed out?' }),
      f('code_compliance', 'Code compliance stated', { q: 'Does the written scope state that the work will meet current local plumbing code?' }),
      f('public_utility_marking', 'Public utility marking', { q: 'Will public utility marking (811 / One Call) be requested before digging?' }),
      f('private_utility_locating', 'Private utility locating', { q: 'Private lines are not covered by 811 — is private utility locating included?', highlight: true }),
      f('sewer_locating', 'Sewer locating', { q: 'Is locating the sewer line itself included?' }),
      f('water_locating', 'Water line locating', { q: 'Who is responsible for locating the water service line?' }),
      f('gas_locating', 'Gas line locating responsibilities', { q: 'Who is responsible for locating gas lines on my property?' }),
      f('electric_locating', 'Electric line locating responsibilities', { q: 'Who is responsible for locating buried electric lines?' }),
      f('traffic_control', 'Traffic control', { q: 'If work affects the street, is traffic control included?' }),
      f('municipal_coordination', 'Municipal coordination', { q: 'Who coordinates scheduling with the municipality?' }),
      f('hoa_requirements', 'HOA requirements', { q: 'Are HOA approvals or requirements addressed?' }),
      f('engineering_requirements', 'Engineering requirements', { q: 'Is any engineering or drawing requirement included?' }),
      f('permit_closure', 'Permit closure', { q: 'Who closes out the permit, and will I receive proof it was closed?' })
    ]
  },

  {
    id: 'installation-quality',
    label: 'Installation Quality & Verification',
    group: 'method',
    intro: 'How the work will be performed to manufacturer specification — and how you will be able to prove it was.',
    fields: [
      f('manufacturer_specs_followed', 'Manufacturer installation specifications followed', { q: 'Will installation follow the manufacturer written specification, and is that stated in the contract?' }),
      f('manufacturer_trained_crew', 'Manufacturer-trained crew', { q: 'Is the crew trained by the product manufacturer?' }),
      f('certified_installer', 'Certified installer', { q: 'Is the installer certified for this specific system?' }),
      f('onsite_supervisor', 'On-site supervisor', { q: 'Will a supervisor be on site during the installation?' }),
      f('master_plumber_onsite', 'Master plumber oversight during installation', { q: 'Will a master plumber oversee the installation itself?' }),
      f('installation_documentation', 'Installation documentation provided', { group: 'verification', q: 'Will I receive written installation documentation when the job is complete?' }),
      f('material_batch_numbers', 'Material batch numbers recorded', { group: 'verification', q: 'Will material batch numbers be recorded and given to me?' }),
      f('resin_mixing_documentation', 'Resin mixing documentation', { group: 'verification', q: 'Will resin mixing ratios and times be documented?' }),
      f('temperature_monitoring', 'Temperature monitoring', { q: 'Will cure temperature be monitored and logged?' }),
      f('cure_monitoring', 'Cure monitoring', { q: 'How will you verify the liner fully cured?' }),
      f('pressure_testing', 'Pressure / testing procedure', { q: 'What test will confirm the finished line holds and drains properly?' }),
      f('thickness_verification', 'Liner / coating thickness verification', { group: 'verification', q: 'How will the finished liner thickness be verified against the specification?' }),
      f('slope_verification', 'Pipe slope verification', { q: 'How will you verify the finished line has correct slope?' }),
      f('connection_verification', 'Connection verification', { q: 'How will each connection be verified as properly reinstated and sealed?' }),
      f('before_camera_inspection', 'Before camera inspection', { group: 'verification', q: 'Will a camera inspection be recorded before the work starts?' }),
      f('after_camera_inspection', 'After camera inspection', { group: 'verification', q: 'Will a camera inspection be recorded after the work is finished?', highlight: true }),
      f('before_video_provided', 'Before video provided to homeowner', { group: 'verification', q: 'Will I receive the before video file?' }),
      f('after_video_provided', 'After video provided to homeowner', { group: 'verification', q: 'Will I receive the after video file?', highlight: true }),
      f('written_completion_report', 'Written completion report', { group: 'verification', q: 'Will I receive a written post-installation verification report?', highlight: true }),
      f('installation_photographs', 'Installation photographs', { group: 'verification', q: 'Will progress photographs be taken and provided?' }),
      f('manufacturer_installation_record', 'Manufacturer installation record filed', { group: 'verification', q: 'Will the installation be registered with the manufacturer, and will I get a copy?' })
    ]
  },

  {
    id: 'warranty',
    label: 'Warranty Protection',
    group: 'warranty',
    intro:
      'A "lifetime warranty" headline means nothing on its own. What matters is who pays for labor, excavation, removal, reinstallation, restoration, and diagnostics — and whether any of it survives when you sell the house.',
    fields: [
      f('manufacturer_product_warranty', 'Manufacturer product warranty', { q: 'What exactly does the manufacturer product warranty cover, and for how long?' }),
      f('contractor_material_warranty', 'Contractor material warranty', { q: 'Does your company separately warranty the materials?' }),
      f('contractor_labor_warranty', 'Contractor labor warranty', {
        q: 'If the installed liner fails during the warranty period, does your warranty cover the labor required to diagnose, remove, and reinstall it?',
        highlight: true
      }),
      f('parts_and_labor_warranty', 'Parts-and-labor warranty', { q: 'Is there a single warranty covering both parts and labor?' }),
      f('workmanship_warranty', 'Workmanship warranty', { q: 'How long is the workmanship warranty on this installation?' }),
      f('structural_warranty', 'Structural warranty', { q: 'Is there a structural warranty on the finished pipe?' }),
      f('warranty_restoration_coverage', 'Restoration covered by warranty', { q: 'If warranty work requires digging, who pays to restore the surface again?' }),
      f('warranty_cleanout_coverage', 'Cleanout covered by warranty', { q: 'Is the cleanout covered under the same warranty?' }),
      f('warranty_connection_coverage', 'Connections covered by warranty', { q: 'Are the connections and reinstated laterals covered by the warranty?' }),
      f('contractor_transferable_labor_material_protection', 'Contractor-backed transferable labor + material protection', {
        q: 'Does your company provide its own transferable labor-and-material warranty above and beyond the manufacturer product warranty?',
        highlight: true,
        hint: 'A manufacturer product warranty often replaces the product only — not the labor, excavation, removal, reinstallation, cleanup, restoration, or diagnostics needed to use it.'
      }),
      f('warranty_length', 'Warranty length stated', { q: 'How many years is each warranty, stated in writing?' }),
      f('warranty_lifetime_or_years', 'Lifetime vs number of years defined', { q: 'If you call it a lifetime warranty, whose lifetime — mine, the product, or the company?' }),
      f('warranty_prorated', 'Prorated or non-prorated', { q: 'Is the warranty prorated over time, or full value for the whole term?' }),
      f('warranty_transferable', 'Transferable to next homeowner', {
        q: 'Is the warranty transferable to the next homeowner if I sell?',
        highlight: true
      }),
      f('warranty_transfer_fee', 'Transfer fee', { q: 'Is there a fee to transfer the warranty, and how much?' }),
      f('warranty_transfer_deadline', 'Transfer deadline', { q: 'Is there a deadline to transfer the warranty after a sale?' }),
      f('warranty_registration_required', 'Registration requirement', { q: 'Must I register the warranty, and by when?' }),
      f('warranty_labor_after_transfer', 'Labor included after transfer', { q: 'After transfer, does the warranty still cover labor for the new owner?' }),
      f('warranty_materials_after_transfer', 'Materials included after transfer', { q: 'After transfer, does the warranty still cover materials?' }),
      f('warranty_diagnostic_costs', 'Diagnostic costs included', { q: 'Who pays for the camera inspection and diagnostics needed to prove a warranty claim?' }),
      f('warranty_excavation_covered', 'Excavation included in warranty work', { q: 'If warranty repair requires excavation, who pays for it?', highlight: true }),
      f('warranty_removal_covered', 'Removal included in warranty work', { q: 'Does the warranty pay to remove the failed material?' }),
      f('warranty_reinstallation_covered', 'Reinstallation included in warranty work', { q: 'Does the warranty pay to reinstall the replacement?' }),
      f('warranty_cleanup_covered', 'Cleanup included in warranty work', { q: 'Is cleanup after warranty work covered?' }),
      f('warranty_surface_restoration_covered', 'Surface restoration included in warranty work', { q: 'Is surface restoration after warranty work covered?' }),
      f('warranty_travel_service_charges', 'Travel / service charges included', { q: 'Are trip or service call charges waived under warranty?' }),
      f('warranty_major_exclusions', 'Major warranty exclusions disclosed', {
        transparency: true,
        q: 'What are the major exclusions in your warranty, in writing?'
      })
    ]
  },

  {
    id: 'price',
    label: 'Price & Payment',
    group: 'price',
    intro:
      'This section scores how clearly the price is broken down and how additional costs are defined — not whether the price is low.',
    fields: [
      f('base_price', 'Base estimate price', { q: 'What is the base price before any options or allowances?' }),
      f('total_price', 'Total estimate price', { q: 'What is the total price I would sign for today?', highlight: true }),
      f('taxes', 'Taxes', { q: 'Is sales tax included in the total?' }),
      f('price_permit_costs', 'Permit costs in price', { q: 'Are permit costs inside the quoted total or billed separately?' }),
      f('engineering_costs', 'Engineering costs', { q: 'Are any engineering costs included?' }),
      f('price_inspection_costs', 'Inspection costs in price', { q: 'Are inspection costs inside the quoted total?' }),
      f('material_costs', 'Material costs broken out', { q: 'Can you break out the material cost?' }),
      f('labor_costs', 'Labor costs broken out', { q: 'Can you break out the labor cost?' }),
      f('equipment_costs', 'Equipment costs broken out', { q: 'Are equipment costs itemized?' }),
      f('mobilization', 'Mobilization', { q: 'Is a mobilization charge included, and is it refundable if the job is cancelled?' }),
      f('disposal_costs', 'Disposal costs', { q: 'Are disposal and dump fees included?' }),
      f('restoration_costs', 'Restoration costs identified in price', { q: 'How much of this total is allocated to surface restoration?' }),
      f('deposit', 'Deposit', { q: 'What deposit is required, and when?' }),
      f('progress_payments', 'Progress payments', { q: 'What is the progress payment schedule?' }),
      f('final_payment', 'Final payment terms', { q: 'What must be complete before final payment is due?' }),
      f('financing_available', 'Financing available', { q: 'Do you offer financing for this project?' }),
      f('financing_terms', 'Financing terms documented', { q: 'What are the financing terms, rate, and length in writing?' }),
      f('change_order_terms', 'Change-order terms', { q: 'What are your written change-order terms?', highlight: true }),
      f('price_additional_footage', 'Price for additional footage', { q: 'What is the per-foot price if more footage is needed than quoted?', highlight: true }),
      f('price_additional_excavation', 'Price for additional excavation', { q: 'What is the price if additional excavation is required?', highlight: true }),
      f('price_additional_cleanouts', 'Price for additional cleanouts', { q: 'What does each additional cleanout cost?' }),
      f('rock_charges', 'Rock charges defined', { q: 'What is the rock charge, and how is rock measured and documented?' }),
      f('groundwater_charges', 'Groundwater charges defined', { q: 'What is the charge if groundwater must be pumped?' }),
      f('emergency_charges', 'Emergency charges defined', { q: 'What are your emergency rates if something goes wrong?' }),
      f('weekend_charges', 'Weekend / after-hours charges defined', { q: 'Are weekend or after-hours rates different?' }),
      f('cancellation_terms', 'Cancellation terms', { q: 'What happens financially if I cancel before work begins?' }),
      f('refund_terms', 'Refund terms', { q: 'Under what conditions is a deposit refundable?' })
    ]
  },

  {
    id: 'exclusions',
    label: 'Exclusions & Hidden Cost Risks',
    group: 'scope',
    transparency: true,
    intro:
      'These rows are scored on disclosure, not inclusion. A clearly written exclusion is honest and lets you plan. Silence is what turns into a surprise invoice mid-job.',
    fields: [
      f('exclusion_rock', 'Rock / hard digging addressed in writing', { q: 'What happens to the price if you hit rock?' }),
      f('exclusion_concrete', 'Concrete addressed in writing', { q: 'What happens if concrete must be cut or removed beyond the quoted area?' }),
      f('exclusion_buried_utilities', 'Buried utilities addressed in writing', { q: 'What happens if a buried utility is in the excavation path?' }),
      f('exclusion_private_utilities', 'Private utilities addressed in writing', { q: 'Who pays if an unmarked private utility line is damaged?', highlight: true }),
      f('exclusion_groundwater', 'Groundwater addressed in writing', { q: 'What happens to the price if the trench fills with groundwater?' }),
      f('exclusion_contaminated_soil', 'Contaminated soil addressed in writing', { q: 'What happens if contaminated soil is found?' }),
      f('exclusion_hazardous_material', 'Hazardous material addressed in writing', { q: 'What happens if hazardous material such as asbestos pipe wrap is found?' }),
      f('exclusion_unknown_connections', 'Unknown connections addressed in writing', { q: 'What happens if an unknown connection ties into the line?' }),
      f('exclusion_municipal_connection', 'Municipal connection addressed in writing', { q: 'Is the connection to the municipal main included, or is that a separate cost?' }),
      f('exclusion_septic_defects', 'Septic defects addressed in writing', { q: 'If a septic component is defective, is that inside or outside this scope?' }),
      f('exclusion_additional_deterioration', 'Additional pipe deterioration addressed in writing', { q: 'What happens if more of the pipe turns out to be deteriorated than expected?' }),
      f('exclusion_collapsed_pipe', 'Collapsed pipe addressed in writing', { q: 'If a collapse is found once work starts, how does the price change?' }),
      f('exclusion_landscaping', 'Landscaping addressed in writing', { q: 'Is landscaping damage inside or outside your scope?' }),
      f('exclusion_trees', 'Trees addressed in writing', { q: 'What happens if a tree must be removed or is damaged?' }),
      f('exclusion_roots', 'Roots addressed in writing', { q: 'Is root removal included, or an extra charge?' }),
      f('exclusion_interior_finishes', 'Interior finishes addressed in writing', { q: 'If interior finishes must be opened, who repairs them?' }),
      f('exclusion_utility_relocation', 'Utility relocation addressed in writing', { q: 'If a utility must be relocated, who pays?' }),
      f('exclusion_structural_repair', 'Structural repair addressed in writing', { q: 'If structural repair becomes necessary, is that in scope?' }),
      f('exclusion_code_upgrades', 'Code upgrades addressed in writing', { q: 'If the inspector requires a code upgrade, who pays for it?' }),
      f('exclusion_weather_delays', 'Weather delays addressed in writing', { q: 'How are weather delays handled?' }),
      f('exclusion_municipal_delays', 'Municipal delays addressed in writing', { q: 'How are municipal permit or inspection delays handled?' }),
      f('exclusion_hidden_conditions', 'Hidden conditions addressed in writing', { q: 'What is your general policy for hidden or unforeseen conditions?' }),
      f('exclusion_other', 'Other exclusions listed', { q: 'Is there a complete written list of exclusions I should read?' }),
      f('additional_work_pricing_method', 'How additional work is priced', {
        transparency: false,
        q: 'How is additional work priced — fixed unit rates, time and materials, or a new quote?',
        highlight: true
      }),
      f('written_approval_required', 'Written approval required before additional work', {
        transparency: false,
        q: 'Will you get my written approval before performing any additional work?',
        highlight: true
      }),
      f('work_stops_until_approval', 'Work stops until the homeowner approves extra charges', {
        transparency: false,
        q: 'Does work stop until I approve extra charges, or do you proceed and bill me after?'
      }),
      f('change_order_pricing_defined', 'Change-order pricing clearly defined', {
        transparency: false,
        q: 'Are change-order prices defined up front so I know the numbers before I approve?'
      })
    ]
  },

  {
    id: 'customer-experience',
    label: 'Customer Experience',
    group: 'customer',
    intro: 'What the days of the project will actually look like, and who you talk to when something goes wrong.',
    fields: [
      f('estimated_start_date', 'Estimated start date', { q: 'What is the estimated start date?' }),
      f('estimated_completion_date', 'Estimated completion date', { q: 'What is the estimated completion date?' }),
      f('number_of_workdays', 'Number of workdays', { q: 'How many workdays will the project take?' }),
      f('service_interruption', 'Expected sewer service interruption', { q: 'How long will I be unable to use my sewer?', highlight: true }),
      f('working_hours', 'Working hours', { q: 'What hours will crews be on site?' }),
      f('crew_size', 'Crew size', { q: 'How many people will be working on site?' }),
      f('project_manager', 'Assigned project manager', { q: 'Who is the assigned project manager?' }),
      f('customer_contact_person', 'Customer contact person', { q: 'Who is my single point of contact during the job?' }),
      f('progress_communication', 'Progress communication method', { q: 'How will you keep me updated on progress each day?' }),
      f('property_access_requirements', 'Property access requirements', { q: 'What access do you need, and do I have to be home?' }),
      f('equipment_placement', 'Equipment placement', { q: 'Where will trucks and equipment be parked or staged?' }),
      f('noise_expectations', 'Noise expectations', { q: 'How loud will this be, and during which hours?' }),
      f('odor_expectations', 'Odor expectations', { q: 'Should I expect sewer odor, and for how long?' }),
      f('homeowner_preparation', 'Homeowner preparation requirements', { q: 'What do I need to do to prepare before you arrive?' }),
      f('completion_walkthrough', 'Completion walkthrough', { q: 'Will we do a walkthrough together before you leave?' }),
      f('customer_final_inspection', 'Final inspection with homeowner', { q: 'Will I be present for the final inspection?' }),
      f('customer_permit_closure', 'Permit closure confirmation to homeowner', { q: 'Will you send me written confirmation the permit was closed?' }),
      f('warranty_documents_delivered', 'Warranty documents delivered', { q: 'When will I receive the actual warranty documents?', highlight: true }),
      f('emergency_contact', 'Emergency contact', { q: 'Who do I call after hours if something goes wrong?' }),
      f('complaint_escalation', 'Complaint escalation process', { q: 'If I am not satisfied, what is the escalation process?' }),
      f('satisfaction_commitment', 'Satisfaction commitment', { q: 'Is there a written satisfaction commitment?' }),
      f('final_cleanup', 'Final cleanup', { q: 'What does final cleanup include?' })
    ]
  },

  {
    id: 'repair-options',
    label: 'Repair Options Provided',
    group: 'scope',
    intro:
      'Providing one option is not automatically a problem — but multiple documented options show the contractor considered alternatives against your actual pipe condition.',
    fields: [
      f('multiple_options_provided', 'More than one repair option provided', { q: 'Did you consider more than one repair option for my line?', highlight: true }),
      f('option_good', 'Good option documented', { q: 'What would a lower-cost viable repair look like?' }),
      f('option_better', 'Better option documented', { q: 'What would a mid-tier repair option look like?' }),
      f('option_best', 'Best option documented', { q: 'What would the most durable repair option look like?' }),
      f('option_lowest_cost_viable', 'Lowest-cost viable repair documented', { q: 'What is the least expensive option that would actually solve the problem?' }),
      f('option_most_durable', 'Most durable repair documented', { q: 'Which option would last the longest?' }),
      f('option_least_destructive', 'Least-destructive repair documented', { q: 'Which option causes the least damage to my property?' }),
      f('option_partial_repair', 'Partial repair option documented', { q: 'Would a spot or partial repair be viable here?' }),
      f('option_full_replacement', 'Full replacement option documented', { q: 'Was full replacement considered, and why was it or was it not chosen?' }),
      f('option_trenchless', 'Trenchless option documented', { q: 'Is a trenchless option viable for my line?' }),
      f('option_excavation', 'Excavation option documented', { q: 'Was a traditional excavation option priced for comparison?' }),
      f('option_pricing_provided', 'Pricing provided per option', { q: 'What does each option cost?' }),
      f('option_service_life_stated', 'Expected service life stated per option', { q: 'What is the expected service life of each option?' }),
      f('option_warranty_stated', 'Warranty stated per option', { q: 'Does the warranty differ between the options?' }),
      f('options_match_documented_condition', 'Recommended option matches the documented pipe condition', {
        q: 'How does the option you recommended match what the camera actually documented in my line?',
        highlight: true
      })
    ]
  }
];

/* ------------------------------------------------------------------ */
/* Derived lookups                                                     */
/* ------------------------------------------------------------------ */

export const categoryById = Object.fromEntries(comparisonCategories.map((category) => [category.id, category]));

/** Flat list of every field, with category + resolved score group attached. */
export const allFields = comparisonCategories.flatMap((category) =>
  category.fields.map((field) => ({
    ...field,
    category: category.id,
    categoryLabel: category.label,
    group: field.group || category.group,
    transparency: typeof field.transparency === 'boolean' ? field.transparency : Boolean(category.transparency)
  }))
);

export const fieldByKey = Object.fromEntries(allFields.map((field) => [field.key, field]));

export const allFieldKeys = allFields.map((field) => field.key);

/* ------------------------------------------------------------------ */
/* The 12 questions every homeowner should ask                         */
/* ------------------------------------------------------------------ */

/**
 * Each entry in `fields` is either a key (must be documented) or an array of
 * keys (any one of them documents it — the strongest wins). A question's answer
 * is the WEAKEST of its resolved entries, so a question only reads as covered
 * when every part of it is written down.
 */
export const keyHomeownerQuestions = [
  { id: 'kq1', question: 'Are employees or subcontractors performing the work?', fields: ['employees_or_subs', 'subcontractor_company_identified'] },
  { id: 'kq2', question: 'Who is legally responsible for installation defects?', fields: [['subcontractor_workmanship_responsibility', 'installer_matches_named_contractor'], 'warranty_claim_handler'] },
  { id: 'kq3', question: 'Are exact pipe footage, diameter, depth, and material documented?', fields: ['pipe_footage_documented', 'pipe_diameter_documented', 'pipe_depth_documented', 'pipe_material_documented'] },
  { id: 'kq4', question: 'Are excavation, backfill, and finished restoration included?', fields: ['excavation_included', 'backfill_included', 'driveway_restoration', 'concrete_restoration', 'landscaping_restoration'] },
  { id: 'kq5', question: 'Are permits, inspections, and utility marking included?', fields: ['plumbing_permit', 'final_inspection', 'public_utility_marking', 'private_utility_locating'] },
  { id: 'kq6', question: 'Will before-and-after camera videos be provided?', fields: ['before_video_provided', 'after_video_provided'] },
  { id: 'kq7', question: 'Is there a written post-installation verification report?', fields: ['written_completion_report', 'installation_documentation'] },
  {
    id: 'kq8',
    question: "Does the warranty cover labor and materials, not just the manufacturer's product?",
    fields: [
      ['contractor_labor_warranty', 'parts_and_labor_warranty', 'contractor_transferable_labor_material_protection'],
      ['contractor_material_warranty', 'parts_and_labor_warranty', 'contractor_transferable_labor_material_protection']
    ]
  },
  {
    id: 'kq9',
    question: 'Is the warranty transferable to the next homeowner?',
    fields: [['warranty_transferable', 'contractor_transferable_labor_material_protection'], 'warranty_labor_after_transfer']
  },
  { id: 'kq10', question: 'Are exclusions and potential additional charges written into the estimate?', fields: ['exclusion_hidden_conditions', 'additional_work_pricing_method', 'written_approval_required'] },
  { id: 'kq11', question: 'Were Good/Better/Best or alternative repair options provided?', fields: ['multiple_options_provided', 'option_pricing_provided'] },
  { id: 'kq12', question: 'Does the recommended repair match the documented pipe condition?', fields: ['options_match_documented_condition', 'existing_pipe_suitable_for_method', 'method_selection_explained'] }
];

/* ------------------------------------------------------------------ */
/* Step 1 — project basics intake                                      */
/* ------------------------------------------------------------------ */

export const projectBasicsFields = [
  {
    name: 'pipeLengthFeet',
    label: 'Approximate pipe length in feet',
    type: 'number',
    placeholder: 'Example: 60',
    hint: 'A rough guess is fine. Leave it blank if you have no idea.'
  },
  {
    name: 'pipeDepthFeet',
    label: 'Approximate depth in feet',
    type: 'number',
    placeholder: 'Example: 6',
    hint: 'Depth strongly affects cost. An estimate is fine.'
  },
  {
    name: 'surfaceType',
    label: 'Surface type above the line',
    type: 'select',
    options: ['Unknown', 'Grass', 'Landscaping', 'Dirt/soil', 'Concrete', 'Asphalt', 'Driveway', 'Sidewalk', 'Patio', 'Pavers', 'Basement floor', 'Interior finished area', 'Other']
  },
  {
    name: 'knownDefect',
    label: 'Known defect or concern',
    type: 'select',
    options: ['Unknown', 'Root intrusion', 'Cracked pipe', 'Broken pipe', 'Collapsed pipe', 'Offset joint', 'Pipe belly', 'Corrosion', 'Scaling', 'Infiltration', 'Recurring blockage', 'Sewer backup', 'Slow drainage', 'Other']
  },
  {
    name: 'pipeMaterial',
    label: 'Existing pipe material',
    type: 'select',
    options: ['Unknown', 'Cast iron', 'Clay', 'PVC', 'ABS', 'Orangeburg', 'Concrete', 'Other']
  },
  {
    name: 'pipeDiameter',
    label: 'Approximate pipe diameter',
    type: 'select',
    options: ['Unknown', '2 inch', '3 inch', '4 inch', '6 inch', '8 inch', 'Other']
  },
  {
    name: 'propertyType',
    label: 'Property type',
    type: 'select',
    options: ['Single-family home', 'Multi-family home', 'Commercial', 'Mixed use', 'Other']
  }
];

export const projectBasicsDefaults = {
  pipeLengthFeet: '',
  pipeDepthFeet: '',
  surfaceType: 'Unknown',
  knownDefect: 'Unknown',
  pipeMaterial: 'Unknown',
  pipeDiameter: 'Unknown',
  propertyType: 'Single-family home'
};

/* ------------------------------------------------------------------ */
/* Repair methods + upload states                                      */
/* ------------------------------------------------------------------ */

export const repairMethods = [
  'CIPP pipe lining',
  'Pipe bursting',
  'Pipe coating',
  'Traditional excavation',
  'Spot repair',
  'Full replacement',
  'Combination repair',
  'Other'
];

export const UPLOAD_STATE = {
  EMPTY: 'not_uploaded',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETE: 'analysis_complete',
  ERROR: 'error'
};

export const uploadStateMeta = {
  [UPLOAD_STATE.EMPTY]: { label: 'Not uploaded', tone: 'neutral' },
  [UPLOAD_STATE.UPLOADING]: { label: 'Uploading…', tone: 'info' },
  [UPLOAD_STATE.UPLOADED]: { label: 'Uploaded', tone: 'positive' },
  [UPLOAD_STATE.PROCESSING]: { label: 'Processing', tone: 'info' },
  [UPLOAD_STATE.COMPLETE]: { label: 'Analysis complete', tone: 'positive' },
  [UPLOAD_STATE.ERROR]: { label: 'Error', tone: 'negative' }
};

export const acceptedUploadTypes = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.txt';

export const MAX_ESTIMATES = 3;

/* ------------------------------------------------------------------ */
/* Contractor summary labels                                           */
/* ------------------------------------------------------------------ */

export const contractorLabels = {
  MOST_COMPLETE: 'Most Complete Estimate',
  STRONGEST_WARRANTY: 'Strongest Warranty Protection',
  CLEAREST_SCOPE: 'Clearest Scope',
  LOWEST_PRICE: 'Lowest Initial Price',
  MOST_MISSING: 'Most Missing Information'
};

export const DISCLAIMER =
  'This is an automated comparison of the estimate documents you uploaded. It is not legal, engineering, plumbing, or financial advice, and it is not a substitute for a professional inspection. The analysis can only reflect what is written in the documents provided — it cannot verify field conditions, confirm code compliance, or guarantee pricing. Confirm every item directly with each contractor in writing before signing anything.';
