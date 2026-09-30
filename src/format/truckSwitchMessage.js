const { formatSubmittedByPrefix } = require('./submittedBy');

function formatUsergroupMention(usergroupId, fallbackLabel) {
  if (usergroupId) {
    return `<!subteam^${usergroupId}|${fallbackLabel}>`;
  }
  return `@${fallbackLabel}`;
}

function formatSystemTeamMentions(systemKey, meta) {
  const safety = formatUsergroupMention(
    meta.safetyTeamUsergroupId,
    'safetyteam'
  );
  const trackAndTrace = formatUsergroupMention(
    meta.trackAndTraceTeamUsergroupId,
    'trackandtraceteam'
  );
  const eld = formatUsergroupMention(
    meta.maintenanceTeamUsergroupId,
    'eldteam'
  );

  if (systemKey === 'fuel' || systemKey === 'tms') {
    return `${safety} ${trackAndTrace}`;
  }
  if (systemKey === 'samsara') {
    return eld;
  }
  return safety;
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

function formatAttachmentsLine(submission) {
  const names = submission.attachmentNames;
  if (!names?.length) {
    return '';
  }
  return `\n*Attachments:* ${names.join(', ')}`;
}

function formatPostHeaderText(submission, meta) {
  const requiredUpdates = submission.requiredUpdates || 'Truck switch.';
  const locationBlock = submission.locationNote
    ? `\n*Location Note:* ${submission.locationNote}`
    : '';
  const attachmentsBlock = formatAttachmentsLine(submission);

  return `*TRUCK SWITCH*

${formatSubmittedByPrefix(meta)}*Driver name:* ${submission.driver}

*Equipment Switch Details*

*Old Truck Number:* ${submission.oldTruck}
*New Truck Number:* ${submission.newTruck}
${formatTemporaryLine(submission.switchTemporary)}

*Old Trailer Number:* ${displayTrailer(submission.oldTrailer)}
*New Trailer Number:* ${displayTrailer(submission.newTrailer)}

*Required Updates:* ${requiredUpdates}${locationBlock}${attachmentsBlock}`;
}

function formatSystemRowText(systemKey, meta, { updated }) {
  const labels = {
    fuel: 'Fuel Card',
    samsara: 'Samsara',
    tms: 'TMS',
  };
  const label = labels[systemKey];
  const team = formatSystemTeamMentions(systemKey, meta);
  if (updated) {
    return `*${label}* · ${team} · *UPDATED*`;
  }
  return `*${label}* · ${team}`;
}

function formatWorkCompletedLine(workDone) {
  if (workDone) {
    return '*Work Completed:* :white_check_mark:';
  }
  return '*Work Completed:* :x:';
}

function checksToUpdateFlags(checks) {
  return {
    fuel: Boolean(checks?.fuel),
    samsara: Boolean(checks?.samsara),
    tms: Boolean(checks?.tms),
  };
}

function formatEmailHtml(submission, meta, options = {}) {
  const { phase = 1, checks } = options;
  const updateFlags = checks ? checksToUpdateFlags(checks) : null;
  const workDone = checks && updateFlags.fuel && updateFlags.samsara && updateFlags.tms;

  let text = formatPostHeaderText(submission, meta);
  text += `\n\n*Fuel Card:* ${updateFlags?.fuel ? 'UPDATED' : 'Pending'}`;
  text += `\n*Samsara:* ${updateFlags?.samsara ? 'UPDATED' : 'Pending'}`;
  text += `\n*TMS:* ${updateFlags?.tms ? 'UPDATED' : 'Pending'}`;
  text += `\n\n${formatWorkCompletedLine(workDone).replace(/\*/g, '')}`;

  if (phase === 2 && workDone) {
    text += '\nAll systems updated.';
  }

  const plain = text
    .replace(/\*/g, '')
    .replace(/<@[^>]+>/g, '')
    .replace(/<!subteam[^>]+>/g, '')
    .replace(/:white_check_mark:/g, '✓');

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;white-space:pre-line;">
  <pre style="font-family:Arial,sans-serif;font-size:14px;">${escapeHtml(plain)}</pre>
  <p style="color:#666;font-size:12px;margin-top:24px;">Submitted via /truckswitch · ${escapeHtml(meta.submittedAtIso)}</p>
</body>
</html>`;
}

function formatEmailSubject(submission, options = {}) {
  const { phase = 1 } = options;
  const base = `TRUCK SWITCH — ${submission.driver} — ${submission.newTruck}`;
  if (phase === 2) {
    return `Re: ${base}`;
  }
  return base;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  formatPostHeaderText,
  formatSystemTeamMentions,
  formatSystemRowText,
  formatWorkCompletedLine,
  formatEmailHtml,
  formatEmailSubject,
  checksToUpdateFlags,
  displayTrailer,
};
