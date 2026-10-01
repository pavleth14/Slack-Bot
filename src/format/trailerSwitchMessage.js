const { formatSubmittedByPrefix } = require('./submittedBy');

function formatTrailerDisplay(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  return v.startsWith('#') ? v : `#${v}`;
}

function formatTrailerSwitchLine(submission) {
  const truck = submission.truck;
  const driver = submission.driverName;
  const trailer = formatTrailerDisplay(submission.trailerNumber);
  const location = submission.location;
  const statusWord =
    submission.trailerStatus === 'loaded' ? 'loaded' : 'empty';
  const loadSuffix =
    submission.trailerStatus === 'loaded' && submission.loadNumber
      ? ` Load# ${submission.loadNumber}`
      : '';

  if (submission.action === 'pickup') {
    return `Truck ${truck} ${driver} picked up ${statusWord} trailer ${trailer} from ${location}${loadSuffix}`;
  }

  return `Truck ${truck} ${driver} dropped off ${statusWord} trailer ${trailer} at ${location}${loadSuffix}`;
}

function formatPostBodyText(submission, meta) {
  const line = formatTrailerSwitchLine(submission);
  return `*TRAILER SWITCH*\n\n${formatSubmittedByPrefix(meta)}${line}`;
}

function formatPostFallbackText(submission, meta) {
  const line = formatTrailerSwitchLine(submission);
  const submitter = meta?.submitterUserId
    ? `Submitted by: <@${meta.submitterUserId}>\n\n`
    : '';
  return `TRAILER SWITCH\n\n${submitter}${line}`;
}

function formatEmailSubject(submission) {
  const actionLabel = submission.action === 'pickup' ? 'Pick up' : 'Drop off';
  const trailer = formatTrailerDisplay(submission.trailerNumber);
  return `TRAILER SWITCH — ${actionLabel} — ${submission.truck} — ${submission.driverName} — ${trailer}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEmailHtml(submission, meta) {
  const plain = formatPostBodyText(submission, meta).replace(/\*/g, '');

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;white-space:pre-line;">
  <pre style="font-family:Arial,sans-serif;font-size:14px;">${escapeHtml(plain)}</pre>
  <p style="color:#666;font-size:12px;margin-top:24px;">Submitted via /trailerswitch · ${escapeHtml(meta.submittedAtIso)}</p>
</body>
</html>`;
}

module.exports = {
  formatTrailerDisplay,
  formatTrailerSwitchLine,
  formatPostBodyText,
  formatPostFallbackText,
  formatEmailSubject,
  formatEmailHtml,
};
