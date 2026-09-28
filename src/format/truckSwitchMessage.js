function formatSafetyTeamMention(safetyTeamUsergroupId) {
  if (safetyTeamUsergroupId) {
    return `<!subteam^${safetyTeamUsergroupId}|safetyteam>`;
  }
  return '@safetyteam';
}

function formatEldTeamMention(eldTeamUsergroupId) {
  if (eldTeamUsergroupId) {
    return `<!subteam^${eldTeamUsergroupId}|eldteam>`;
  }
  return '@eldteam';
}

function displayTrailer(value) {
  const v = String(value || '').trim();
  return v || '/';
}

function formatTemporaryLine(isTemporary) {
  if (isTemporary) {
    return 'Switch is Temporary.';
  }
  return 'Switch is not temporary.';
}

function formatAssignmentBlock(meta, { pending, updateFlags }) {
  if (pending) {
    return `Fuel Card: ${formatSafetyTeamMention(meta.safetyTeamUsergroupId)}
Samsara: ${formatEldTeamMention(meta.eldTeamUsergroupId)}
TMS: ${formatSafetyTeamMention(meta.safetyTeamUsergroupId)}`;
  }

  const line = (label, updated) => {
    if (updated) return `${label}: Updated.`;
    return `${label}: NA`;
  };

  return `${line('Fuel Card', updateFlags?.fuel)}
${updateFlags?.samsara ? 'Samsara: Updated.' : 'Samsara:'}
${line('TMS', updateFlags?.tms)}`;
}

function formatCoreBody(submission, meta, { pending, updateFlags, includeProcessComplete } = {}) {
  const requiredUpdates = submission.requiredUpdates || 'Truck switch.';
  const locationBlock = submission.locationNote
    ? `\nLocation Note: ${submission.locationNote}\n`
    : '';

  let body = `*TRUCK SWITCH*

Driver name: ${submission.driver}

*Equipment Switch Details*

Old Truck Number: ${submission.oldTruck}
New Truck Number: ${submission.newTruck}
${formatTemporaryLine(submission.switchTemporary)}

Old Trailer Number: ${displayTrailer(submission.oldTrailer)}
New Trailer Number: ${displayTrailer(submission.newTrailer)}

Required Updates: ${requiredUpdates}${locationBlock}
${formatAssignmentBlock(meta, { pending, updateFlags })}

Status

Work Completed:`;

  if (includeProcessComplete) {
    body += '\nProcess completed :white_check_mark:';
  } else if (!pending && updateFlags) {
    body += '\n_Reply in thread with updates. Control: add :white_check_mark: reaction to verify._';
  }

  return body;
}

/** Phase 1 — teams tagged, work not yet marked complete. */
function formatPhase1Message(submission, meta) {
  return formatCoreBody(submission, meta, { pending: true });
}

/** Phase 2 — thread reply after safety marks systems updated. */
function formatPhase2ThreadMessage(submission, updateFlags, meta) {
  return formatCoreBody(submission, meta, {
    pending: false,
    updateFlags,
  });
}

/** After control verifies (optional bot update). */
function formatPhase2VerifiedMessage(submission, updateFlags, meta, verifierUserId) {
  return `${formatCoreBody(submission, meta, {
    pending: false,
    updateFlags,
    includeProcessComplete: true,
  })}\n\n_Control verified by <@${verifierUserId}>_`;
}

function formatEmailHtml(submission, meta, options = {}) {
  const { phase = 1, updateFlags } = options;
  const pending = phase === 1;
  const text = formatCoreBody(submission, meta, {
    pending,
    updateFlags,
    includeProcessComplete: phase === 2,
  })
    .replace(/\*/g, '')
    .replace(/<@[^>]+>/g, '')
    .replace(/<!subteam[^>]+>/g, '');

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;white-space:pre-line;">
  <pre style="font-family:Arial,sans-serif;font-size:14px;">${escapeHtml(text)}</pre>
  <p style="color:#666;font-size:12px;margin-top:24px;">Submitted via /truckswitch · ${escapeHtml(meta.submittedAtIso)}</p>
</body>
</html>`;
}

function formatEmailSubject(submission, options = {}) {
  const { phase = 1 } = options;
  const prefix = phase === 2 ? 'TRUCK SWITCH — Completed' : 'TRUCK SWITCH';
  return `${prefix} — ${submission.driver} — ${submission.newTruck}`;
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
  formatPhase2VerifiedMessage,
  formatEmailHtml,
  formatEmailSubject,
  displayTrailer,
};
