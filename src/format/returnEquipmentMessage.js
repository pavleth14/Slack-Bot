const { formatSubmittedByPrefix } = require('./submittedBy');

const FIELD_ORDER = [
  ['Driver Name', 'driverName'],
  ['Truck', 'truck'],
  ['Termination Date', 'terminationDateDisplay', 'terminationDate'],
  ['Termination Reason', 'terminationReason'],
  ['Damages', 'damages'],
  ['Mattress', 'mattress'],
  ['Truck Detailing', 'truckDetailing'],
  ['Last Statement Balance', 'lastStatementBalance'],
  ['Escrow', 'escrow'],
  ['Travel Expense', 'travelExpense'],
  ['Recovery Fee', 'recoveryFee'],
];

function fieldValue(submission, primaryKey, fallbackKey) {
  const primary = submission[primaryKey];
  if (primary != null && String(primary).trim()) {
    return String(primary).trim();
  }
  if (fallbackKey != null && submission[fallbackKey] != null) {
    return String(submission[fallbackKey]).trim();
  }
  return '';
}

function displayField(label, value) {
  const text = String(value || '').trim();
  return `*${label}:*\n${text || '_—_'}`;
}

function formatPostBodyText(submission, meta) {
  const lines = FIELD_ORDER.map(([label, key, altKey]) =>
    displayField(label, fieldValue(submission, key, altKey))
  );
  return `*RETURN EQUIPMENT*

${formatSubmittedByPrefix(meta)}${lines.join('\n\n')}`;
}

function formatPostFallbackText(submission, meta) {
  const submitter = meta?.submitterUserId
    ? `Submitted by: <@${meta.submitterUserId}>\n\n`
    : '';
  const driver = fieldValue(submission, 'driverName');
  const truck = fieldValue(submission, 'truck');
  const date = fieldValue(
    submission,
    'terminationDateDisplay',
    'terminationDate'
  );
  const headline =
    driver || truck || date
      ? `${driver} · Truck ${truck} · Term ${date}`.trim()
      : 'Return equipment';
  const detail = FIELD_ORDER.slice(3)
    .map(([label, key, altKey]) => {
      const v = fieldValue(submission, key, altKey);
      return v ? `${label}: ${v}` : null;
    })
    .filter(Boolean)
    .join('\n');
  return `RETURN EQUIPMENT\n\n${submitter}${headline}${detail ? `\n${detail}` : ''}`;
}

module.exports = {
  formatPostBodyText,
  formatPostFallbackText,
};
