const { GROUP_BY_KEY } = require('../blocks/dotFields');

const CHECKBOX_LIMIT = 10;

function chunkOptions(options, size = CHECKBOX_LIMIT) {
  const parts = [];
  for (let i = 0; i < options.length; i += size) {
    parts.push(options.slice(i, i + size));
  }
  return parts;
}

function selectionList(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw) return [String(raw)];
  return [];
}

function parseDotSelectionActionId(actionId) {
  const match = /^dot_sel_([A-Za-z0-9]+)__p(\d+)(?:__r\d+)?$/.exec(actionId || '');
  if (!match) return null;
  return { key: match[1], part: Number(match[2]) };
}

function applyExclusiveDelta(canonical, partValues, seenSelected, clickedSelected) {
  const part = new Set(partValues);
  const seen = new Set((seenSelected || []).filter((value) => part.has(value)));
  const clicked = (clickedSelected || []).filter((value) => part.has(value));
  const added = clicked.filter((value) => !seen.has(value));
  if (added.length) return [added[added.length - 1]];
  const removed = new Set(
    clicked.length ? [...seen].filter((value) => !clicked.includes(value)) : [...seen]
  );
  if (!removed.size) return selectionList(canonical);
  return selectionList(canonical).filter((value) => !removed.has(value));
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

function applyDotGroupSelection(key, canonical, partValues, seenSelected, clickedSelected) {
  const mode = GROUP_BY_KEY[key]?.postMode || 'multi';
  if (seenSelected == null) {
    const part = new Set(partValues);
    const clicked = (clickedSelected || []).filter((value) => part.has(value));
    if (mode === 'exclusive') {
      if (!clicked.length) {
        return selectionList(canonical).filter((value) => !part.has(value));
      }
      return [clicked[clicked.length - 1]];
    }
    const kept = selectionList(canonical).filter((value) => !part.has(value));
    return [...kept, ...clicked];
  }
  if (mode === 'exclusive') {
    return applyExclusiveDelta(canonical, partValues, seenSelected, clickedSelected);
  }
  return applyMultiDelta(canonical, partValues, seenSelected, clickedSelected);
}

module.exports = {
  chunkOptions,
  selectionList,
  parseDotSelectionActionId,
  applyDotGroupSelection,
};
