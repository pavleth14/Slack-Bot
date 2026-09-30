function formatLoadHeadline(submission) {
  const date = submission.loadDateDisplay || submission.loadDate;
  return `${date} RC ${submission.confirmationNumber} ${submission.driverName} ${submission.truck}`;
}

function formatPostBodyText(submission, meta) {
  const headline = formatLoadHeadline(submission);
  const notes = submission.notes?.trim();
  if (!notes) {
    return headline;
  }
  return `${headline}\n\n*Notes:*\n${notes}`;
}

function formatPostFallbackText(submission) {
  const notes = submission.notes?.trim();
  if (!notes) {
    return formatLoadHeadline(submission);
  }
  return `${formatLoadHeadline(submission)}\nNotes: ${notes}`;
}

function formatEmailSubject(submission) {
  return `LOAD — ${submission.confirmationNumber} — ${submission.driverName} — ${submission.truck}`;
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
  <p style="color:#666;font-size:12px;margin-top:24px;">Submitted via /loads · ${escapeHtml(meta.submittedAtIso)}</p>
</body>
</html>`;
}

module.exports = {
  formatLoadHeadline,
  formatPostBodyText,
  formatPostFallbackText,
  formatEmailSubject,
  formatEmailHtml,
};
