function formatSubmittedByLine(meta) {
  const userId = meta?.submitterUserId;
  if (!userId) {
    return '';
  }
  return `*Submitted by:* <@${userId}>`;
}

function formatSubmittedByPrefix(meta) {
  const line = formatSubmittedByLine(meta);
  return line ? `${line}\n\n` : '';
}

module.exports = {
  formatSubmittedByLine,
  formatSubmittedByPrefix,
};
