const { formatSubmittedByPrefix } = require('./submittedBy');

function displayField(label, value) {
  const text = String(value || '').trim();
  return `*${label}:*\n${text || '_—_'}`;
}

function formatPostBodyText(submission, meta) {
  return `*RETURN EQUIPMENT*

${formatSubmittedByPrefix(meta)}${displayField('Damages', submission.damages)}

${displayField('Mattress', submission.mattress)}

${displayField('Truck Detailing', submission.truckDetailing)}`;
}

function formatPostFallbackText(submission, meta) {
  const submitter = meta?.submitterUserId
    ? `Submitted by: <@${meta.submitterUserId}>\n\n`
    : '';
  const parts = [
    submission.damages && `Damages: ${submission.damages}`,
    submission.mattress && `Mattress: ${submission.mattress}`,
    submission.truckDetailing &&
      `Truck Detailing: ${submission.truckDetailing}`,
  ].filter(Boolean);
  return `RETURN EQUIPMENT\n\n${submitter}${parts.join('\n') || 'Return equipment'}`;
}

module.exports = {
  formatPostBodyText,
  formatPostFallbackText,
};
