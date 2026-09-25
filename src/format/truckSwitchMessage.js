const CHECKLIST_ITEMS = [
  { key: 'fuel', label: 'Fuel card' },
  { key: 'samsara', label: 'Samsara' },
  { key: 'tms', label: 'TMS' },
];

function formatSafetyTeamMention(safetyTeamUsergroupId) {
  if (safetyTeamUsergroupId) {
    return `<!subteam^${safetyTeamUsergroupId}|safetyteam>`;
  }
  return '@safetyteam';
}

function formatControlTeamMention(controlTeamUsergroupId) {
  if (controlTeamUsergroupId) {
    return `<!subteam^${controlTeamUsergroupId}|controlteam>`;
  }
  return '@controlteam';
}

function formatChecklistLines(updateFlags, { pending = false } = {}) {
  return CHECKLIST_ITEMS.map(({ key, label }) => {
    if (pending || !updateFlags) {
      return `• ${label} -`;
    }
    const suffix = updateFlags[key] ? 'updated' : '-';
    return `• ${label} - ${suffix}`;
  }).join('\n');
}

function formatVehicleBlock(submission) {
  return `${submission.driver}

Old Truck Number
${submission.oldTruck}

New Truck Number
${submission.newTruck}

Old Trailer Number
${submission.oldTrailer}

New Trailer Number
${submission.newTrailer}`;
}

/** Phase 1 — initial request, checklist pending. */
function formatPhase1Message(submission, meta) {
  const checklist = formatChecklistLines(null, { pending: true });
  const mention = formatSafetyTeamMention(meta.safetyTeamUsergroupId);
  return `${formatVehicleBlock(submission)}

${checklist}

${mention}`;
}

/** Phase 2 — thread reply after safety marks complete. */
function formatPhase2ThreadMessage(submission, updateFlags, meta) {
  const checklist = formatChecklistLines(updateFlags);
  const mention = formatControlTeamMention(meta.controlTeamUsergroupId);
  return `${formatVehicleBlock(submission)}

${checklist}

Work Completed

${mention}`;
}

function formatEmailHtml(submission, meta, options = {}) {
  const { phase = 1, updateFlags } = options;
  const checklistLines =
    phase === 1
      ? formatChecklistLines(null, { pending: true })
      : formatChecklistLines(updateFlags);
  const checklistHtml = checklistLines
    .split('\n')
    .map((line) => `<li>${escapeHtml(line.replace(/^•\s*/, ''))}</li>`)
    .join('\n');

  const footerTeam = phase === 1 ? '@safetyteam' : '@controlteam — Work Completed';
  const extra = phase === 2 ? '<p style="margin:16px 0 0;"><strong>Work Completed</strong></p>' : '';

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
  ${extra}
  <p style="margin:0;">${escapeHtml(footerTeam)}</p>
  <p style="color:#666;font-size:12px;margin-top:24px;">Submitted via /truckswitch · ${escapeHtml(meta.submittedAtIso)}</p>
</body>
</html>`;
}

function formatEmailSubject(submission, options = {}) {
  const { phase = 1 } = options;
  const prefix = phase === 2 ? 'Unit Switch Completed' : 'Unit Switch';
  return `${prefix} — ${submission.driver} — ${submission.newTruck}/${submission.newTrailer}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  formatPhase1Message,
  formatPhase2ThreadMessage,
  formatEmailHtml,
  formatEmailSubject,
  formatVehicleBlock,
  formatChecklistLines,
};
