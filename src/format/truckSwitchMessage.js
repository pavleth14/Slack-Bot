const { formatSubmittedByPrefix } = require('./submittedBy');
const { isSystemChecked } = require('../util/truckSwitchChecks');

const CHECK_DISPLAY_TIMEZONE =
  process.env.APP_TIMEZONE?.trim() || 'America/Chicago';

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

function formatCheckClockTime(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CHECK_DISPLAY_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms));
}

function formatResponseDuration(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  const ms = toMs - fromMs;
  if (ms < 0) return null;

  const sec = Math.floor(ms / 1000);
  if (sec < 60) {
    return sec <= 1 ? '1 sec' : `${sec} sec`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return min === 1 ? '1 min' : `${min} min`;
  }
  const hours = Math.floor(min / 60);
  const remMin = min % 60;
  if (remMin === 0) {
    return hours === 1 ? '1 hr' : `${hours} hr`;
  }
  return `${hours} hr ${remMin} min`;
}

function formatCheckContextLine(check, postSubmittedAtIso) {
  const line = `Checked by <@${check.userId}>`;
  const checkedAt = formatCheckClockTime(check.checkedAtIso);
  const duration = formatResponseDuration(postSubmittedAtIso, check.checkedAtIso);
  if (checkedAt && duration) {
    return `${line} · ${checkedAt} · Response time: _${duration}_`;
  }
  if (checkedAt) {
    return `${line} · ${checkedAt}`;
  }
  if (duration) {
    return `${line} · Response time: _${duration}_`;
  }
  return line;
}

function checksToUpdateFlags(checks) {
  return {
    fuel: isSystemChecked(checks?.fuel),
    samsara: isSystemChecked(checks?.samsara),
    tms: isSystemChecked(checks?.tms),
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
  formatCheckContextLine,
  formatEmailHtml,
  formatEmailSubject,
  checksToUpdateFlags,
  displayTrailer,
};
