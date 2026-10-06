const CHECKBOX_LIMIT = 10;

/**
 * Posted checkbox groups.
 * 'multi' — several boxes in one group can stay checked.
 * 'exclusive' — checking a box clears the others in that same group.
 * Switch this for the whole form; it does not change the modal.
 */
const POST_SELECTION_MODE = 'multi';

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
  const match = /^claims_sel_([A-Za-z0-9]+)__p(\d+)(?:__r\d+)?$/.exec(actionId || '');
  if (!match) return null;
  return { key: match[1], part: Number(match[2]) };
}

function selectionList(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw) return [String(raw)];
  return [];
}

function hasSelection(raw, value) {
  return selectionList(raw).includes(value);
}

function applyMultiDelta(canonical, partValues, seenSelected, clickedSelected) {
  const part = new Set(partValues);
  const seen = new Set((seenSelected || []).filter((value) => part.has(value)));
  const clicked = new Set((clickedSelected || []).filter((value) => part.has(value)));
  const next = new Set(selectionList(canonical));
  for (const value of part) {
    if (clicked.has(value) && !seen.has(value)) next.add(value);
    if (!clicked.has(value) && seen.has(value)) next.delete(value);
  }
  return [...next];
}

function applyExclusiveDelta(canonical, partValues, seenSelected, clickedSelected) {
  const part = new Set(partValues);
  const seen = new Set((seenSelected || []).filter((value) => part.has(value)));
  const clicked = (clickedSelected || []).filter((value) => part.has(value));
  const added = clicked.filter((value) => !seen.has(value));
  if (added.length) return [added[added.length - 1]];
  const removed = new Set(clicked.length ? [...seen].filter((value) => !clicked.includes(value)) : [...seen]);
  if (!removed.size) return selectionList(canonical);
  return selectionList(canonical).filter((value) => !removed.has(value));
}

/**
 * Merge one person's click into the shared selection.
 * seenSelected is what that person was looking at. Null means the old message
 * did not include it, so this click replaces that part of the group.
 */
function applyGroupSelection(canonical, partValues, seenSelected, clickedSelected) {
  if (seenSelected == null) {
    const part = new Set(partValues);
    const clicked = (clickedSelected || []).filter((value) => part.has(value));
    if (POST_SELECTION_MODE === 'exclusive') {
      if (!clicked.length) return selectionList(canonical).filter((value) => !part.has(value));
      const current = selectionList(canonical);
      const added = clicked.filter((value) => !current.includes(value));
      return [added[added.length - 1] || clicked[clicked.length - 1]];
    }
    const kept = selectionList(canonical).filter((value) => !part.has(value));
    return [...kept, ...clicked];
  }
  if (POST_SELECTION_MODE === 'exclusive') {
    return applyExclusiveDelta(canonical, partValues, seenSelected, clickedSelected);
  }
  return applyMultiDelta(canonical, partValues, seenSelected, clickedSelected);
}

function claimIndicator(submission) {
  const status = submission?.claimStatus;
  const resolution = submission?.resolution;
  if (hasSelection(resolution, 'denied') || hasSelection(status, 'closed_no_payment')) {
    return { emoji: '🔴', label: 'Rejected' };
  }
  if (
    hasSelection(status, 'closed_paid') ||
    hasSelection(status, 'settled') ||
    hasSelection(resolution, 'paid_insurance') ||
    hasSelection(resolution, 'paid_company') ||
    hasSelection(resolution, 'settled')
  ) {
    return { emoji: '🟢', label: 'Paid and closed' };
  }
  return { emoji: '🟡', label: 'Ongoing' };
}

module.exports = {
  CHECKBOX_LIMIT,
  POST_SELECTION_MODE,
  chunkOptions,
  resolveExclusive,
  resolveMulti,
  parseSelectionActionId,
  selectionList,
  applyGroupSelection,
  claimIndicator,
};
