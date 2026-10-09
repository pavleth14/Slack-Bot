function opt(value, text) {
  return { value, text };
}

const INSPECTION_LEVEL_OPTIONS = [
  opt('I', 'I'),
  opt('II', 'II'),
  opt('III', 'III'),
  opt('other', 'Other'),
];

const INSPECTION_RESULT_OPTIONS = [
  opt('passed', 'Passed'),
  opt('violations_found', 'Violations Found'),
  opt('out_of_service', 'Out of Service'),
];

const VIOLATION_SUBJECT_OPTIONS = [
  opt('driver', 'Driver'),
  opt('truck', 'Truck'),
  opt('trailer', 'Trailer'),
];

const CITATION_OPTIONS = [
  opt('yes', 'Yes'),
  opt('no', 'No'),
];

const CURRENT_STATUS_OPTIONS = [
  opt('back_in_service', 'Back in Service'),
  opt('out_of_service', 'Out of Service — Do Not Operate'),
  opt('repairs_needed', 'Repairs Needed'),
];

/** Checkbox groups shared by modal and channel post */
const DOT_GROUPS = [
  {
    key: 'inspectionLevel',
    label: 'Inspection Level',
    options: INSPECTION_LEVEL_OPTIONS,
    postMode: 'exclusive',
  },
  {
    key: 'inspectionResult',
    label: 'Result',
    options: INSPECTION_RESULT_OPTIONS,
    postMode: 'exclusive',
  },
  {
    key: 'violationSubjects',
    label: 'Violation applies to',
    options: VIOLATION_SUBJECT_OPTIONS,
    postMode: 'multi',
  },
  {
    key: 'citationIssued',
    label: 'Citation Issued',
    options: CITATION_OPTIONS,
    postMode: 'exclusive',
  },
  {
    key: 'currentStatus',
    label: 'Current Status',
    options: CURRENT_STATUS_OPTIONS,
    postMode: 'exclusive',
  },
];

const GROUP_BY_KEY = Object.fromEntries(DOT_GROUPS.map((g) => [g.key, g]));

module.exports = {
  DOT_GROUPS,
  GROUP_BY_KEY,
  INSPECTION_LEVEL_OPTIONS,
  INSPECTION_RESULT_OPTIONS,
  VIOLATION_SUBJECT_OPTIONS,
  CITATION_OPTIONS,
  CURRENT_STATUS_OPTIONS,
};
