const CHECKBOX_LIMIT = 10;

function chunkOptions(options, size = CHECKBOX_LIMIT) {
  const parts = [];
  for (let i = 0; i < options.length; i += size) {
    parts.push(options.slice(i, i + size));
  }
  return parts;
}

function resolveExclusive(previous, selectedInPart, partValues) {
  const part = new Set(partValues);
  const chosen = (selectedInPart || []).filter((value) => part.has(value));
  const current = previous || '';
  if (chosen.length === 0) {
    return part.has(current) ? '' : current;
  }
  if (chosen.length === 1) return chosen[0];
  return chosen.find((value) => value !== current) || chosen[chosen.length - 1];
}

function resolveMulti(previous, selectedInPart, partValues) {
  const part = new Set(partValues);
  const kept = (Array.isArray(previous) ? previous : []).filter((value) => !part.has(value));
  const next = (selectedInPart || []).filter((value) => part.has(value));
  return [...kept, ...next];
}

function parseSelectionActionId(actionId) {
  const match = /^claims_sel_([A-Za-z0-9]+)__p(\d+)$/.exec(actionId || '');
  if (!match) return null;
  return { key: match[1], part: Number(match[2]) };
}

function claimIndicator(submission) {
  const status = submission?.claimStatus || '';
  const resolution = submission?.resolution || '';
  if (resolution === 'denied' || status === 'closed_no_payment') {
    return { emoji: '🔴', label: 'Rejected' };
  }
  if (
    status === 'closed_paid' ||
    status === 'settled' ||
    resolution === 'paid_insurance' ||
    resolution === 'paid_company' ||
    resolution === 'settled'
  ) {
    return { emoji: '🟢', label: 'Paid and closed' };
  }
  return { emoji: '🟡', label: 'Ongoing' };
}

module.exports = {
  CHECKBOX_LIMIT,
  chunkOptions,
  resolveExclusive,
  resolveMulti,
  parseSelectionActionId,
  claimIndicator,
};
