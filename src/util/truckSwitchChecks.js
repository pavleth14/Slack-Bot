function normalizeSystemCheck(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { userId: entry, checkedAtIso: null };
  }
  if (entry.userId) {
    return {
      userId: entry.userId,
      checkedAtIso: entry.checkedAtIso || null,
    };
  }
  return null;
}

function isSystemChecked(entry) {
  return Boolean(normalizeSystemCheck(entry));
}

function createSystemCheck(userId) {
  return { userId, checkedAtIso: new Date().toISOString() };
}

module.exports = {
  normalizeSystemCheck,
  isSystemChecked,
  createSystemCheck,
};
