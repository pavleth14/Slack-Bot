const CHECKLIST_LINES = ['Fuel card -', 'Samsara -', 'TMS -'];

function formatSafetyTeamMention(safetyTeamUsergroupId) {
  if (safetyTeamUsergroupId) {
    return `<!subteam^${safetyTeamUsergroupId}|safetyteam>`;
  }
  return '@safetyteam';
}

/**
 * Plain channel message matching the manual Slack template (initial submit).
 */
function formatChannelMessage(submission, meta) {
  const mention = formatSafetyTeamMention(meta.safetyTeamUsergroupId);
  const checklist = CHECKLIST_LINES.map((line) => `• ${line}`).join('\n');

  return `${submission.driver}

Old Truck Number
${submission.oldTruck}

New Truck Number
${submission.newTruck}

Old Trailer Number
${submission.oldTrailer}

New Trailer Number
${submission.newTrailer}

${checklist}

${mention}`;
}

function formatEmailHtml(submission, meta) {
  const checklistHtml = CHECKLIST_LINES.map(
    (line) => `<li>${escapeHtml(line)}</li>`
  ).join('\n');

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;white-space:pre-line;">
  <p style="font-size:16px;margin:0 0 12px;">${escapeHtml(submission.driver)}</p>
  <p style="margin:0 0 16px;line-height:1.5;">
Old Truck Number<br>${escapeHtml(submission.oldTruck)}<br><br>
New Truck Number<br>${escapeHtml(submission.newTruck)}<br><br>
Old Trailer Number<br>${escapeHtml(submission.oldTrailer)}<br><br>
New Trailer Number<br>${escapeHtml(submission.newTrailer)}
  </p>
  <ul style="margin:0 0 16px;">${checklistHtml}</ul>
  <p style="margin:0;">@safetyteam</p>
  <p style="color:#666;font-size:12px;margin-top:24px;">Submitted via /truckswitch · ${escapeHtml(meta.submittedAtIso)}</p>
</body>
</html>`;
}

function formatEmailSubject(submission) {
  return `Truck Switch — ${submission.driver} — ${submission.newTruck}/${submission.newTrailer}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  formatChannelMessage,
  formatEmailHtml,
  formatEmailSubject,
};
