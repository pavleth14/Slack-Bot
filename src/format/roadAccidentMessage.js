const { formatSubmittedByPrefix } = require('./submittedBy');
const { OTHER_PARTY_LABELS } = require('../blocks/roadAccidentModal');

function readYesNoLabel(flag) {
  return flag ? 'Yes' : 'No';
}

function formatSafetyTeamMention(safetyTeamUsergroupId) {
  if (safetyTeamUsergroupId) {
    return `<!subteam^${safetyTeamUsergroupId}|safetyteam>`;
  }
  return '@safetyteam';
}

function displayTrailer(value) {
  const v = String(value || '').trim();
  return v || '/';
}

function formatAccidentDateTime(dateIso, time24) {
  if (!dateIso) return '';
  const parts = dateIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return [dateIso, time24].filter(Boolean).join(' ');
  }
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!time24) {
    return datePart;
  }
  const [hh, mm] = time24.split(':').map(Number);
  const timeDate = new Date(2000, 0, 1, hh || 0, mm || 0);
  const timePart = timeDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} — ${timePart}`;
}

function formatPoliceLine(submission) {
  if (!submission.policeInvolved) {
    return '*Police involved:* No';
  }
  const report = submission.policeReportNumber?.trim();
  return report
    ? `*Police involved:* Yes — Report # ${report}`
    : '*Police involved:* Yes';
}

function formatTowedLine(submission) {
  if (!submission.towedAway) {
    return '*Towed away:* No';
  }
  const info = submission.towingInfo?.trim();
  return info
    ? `*Towed away:* Yes — ${info}`
    : '*Towed away:* Yes';
}

const OTHER_PARTY_POST_LABELS = {
  ...OTHER_PARTY_LABELS,
  liability_statement_video:
    'Written statement from other party accepting liability if no police involved; walk-around video with other vehicle or driver when possible',
};

const OTHER_PARTY_OPTIONS_ORDER = [
  'cdl_photo',
  'insurance_cert',
  'usdot_signs',
  'cab_card',
  'damage_photos',
  'impact_photos',
  'liability_statement_video',
];

function formatOtherPartySection(submission) {
  const selected = submission.otherPartyCollected || [];
  const lines = OTHER_PARTY_OPTIONS_ORDER.map((key) => {
    const label = OTHER_PARTY_POST_LABELS[key] || key;
    const mark = selected.includes(key) ? ':white_check_mark:' : ':white_large_square:';
    return `${mark} ${label}`;
  });
  return lines.join('\n');
}

function formatAttachmentsLine(submission) {
  const count = submission.attachmentNames?.length || 0;
  if (!count) {
    return '*Files uploaded:* None';
  }
  if (count === 1) {
    return '*Files uploaded:* 1 file (see thread)';
  }
  return `*Files uploaded:* ${count} files (see thread)`;
}

function formatPostBodyText(submission, meta) {
  const safety = formatSafetyTeamMention(meta.safetyTeamUsergroupId);
  const yesNo = (v) => readYesNoLabel(v);

  return `*ROAD ACCIDENT REPORT*

${formatSubmittedByPrefix(meta)}*Date / Time:* ${formatAccidentDateTime(
    submission.accidentDate,
    submission.accidentTime
  )}
*Location:* ${submission.location}
*Our Driver:* ${submission.driver}
*Our Truck #:* ${submission.truck}
*Our Trailer #:* ${displayTrailer(submission.trailer)}
*Description:* ${submission.description}

${formatPoliceLine(submission)}
${formatTowedLine(submission)}
*Citation issued:* ${yesNo(submission.citationIssued)}
*Ambulance at the scene:* ${yesNo(submission.ambulanceAtScene)}
*Fuel spill / clean-up:* ${yesNo(submission.fuelSpillCleanup)}

*Other party — information to collect*
${formatOtherPartySection(submission)}

${formatAttachmentsLine(submission)}

${safety} Post accident drug test required? _Reply in this thread with Yes or No._

<!here>`;
}

function formatEmailSubject(submission) {
  return `ROAD ACCIDENT — ${submission.driver} — Truck ${submission.truck}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEmailHtml(submission, meta) {
  const plain = formatPostBodyText(submission, meta)
    .replace(/\*/g, '')
    .replace(/<@[^>]+>/g, (m) => m)
    .replace(/<!subteam[^>]+>/g, '@safetyteam')
    .replace(/<!here>/g, '@here')
    .replace(/_/g, '')
    .replace(/:white_check_mark:/g, '[x]')
    .replace(/:white_large_square:/g, '[ ]');

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;white-space:pre-line;">
  <pre style="font-family:Arial,sans-serif;font-size:14px;">${escapeHtml(plain)}</pre>
  <p style="color:#666;font-size:12px;margin-top:24px;">Submitted via /accident · ${escapeHtml(meta.submittedAtIso)}</p>
</body>
</html>`;
}

module.exports = {
  formatPostBodyText,
  formatEmailSubject,
  formatEmailHtml,
};
