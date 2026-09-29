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

function formatSubmittedAt(iso, submitterUserId) {
  const when = iso ? new Date(iso) : new Date();
  const timePart = when.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `<@${submitterUserId}> at ${timePart}`;
}

function formatPhotosLine(submission) {
  const count = submission.attachmentNames?.length || 0;
  if (!count) {
    return '*Photos:* None attached';
  }
  if (count === 1) {
    return '*Photos:* 1 attached';
  }
  return `*Photos:* ${count} attached`;
}

function formatPostBodyText(submission, meta) {
  const safety = formatSafetyTeamMention(meta.safetyTeamUsergroupId);
  const yesNo = (v) => readYesNoLabel(v);

  return `*ROAD ACCIDENT REPORT*

*Driver:* ${submission.driver}
*Unit:* ${submission.unit}
*Trailer:* ${displayTrailer(submission.trailer)}
*Date/Time of Accident:* ${formatAccidentDateTime(
    submission.accidentDate,
    submission.accidentTime
  )}
*Location:* ${submission.location}
*Incident:* ${submission.incident}
*Injuries:* ${submission.injuries}
*Police:* ${submission.police}
*Citation issued:* ${yesNo(submission.citationIssued)}
*Truck Drivable:* ${yesNo(submission.truckDrivable)}
*Towing Required:* ${yesNo(submission.truckTowingRequired)}
*Trailer Drivable:* ${yesNo(submission.trailerDrivable)}
*Towing Required:* ${yesNo(submission.trailerTowingRequired)}

${formatPhotosLine(submission)}

*Submitted by:* ${formatSubmittedAt(meta.submittedAtIso, meta.submitterUserId)}

${safety} Post accident drug test required? _Reply in this thread with Yes or No._

<!here>`;
}

function formatEmailSubject(submission) {
  return `ROAD ACCIDENT — ${submission.driver} — Unit ${submission.unit}`;
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
    .replace(/_/g, '');

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
