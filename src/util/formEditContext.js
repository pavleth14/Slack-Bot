function buildEditPrivateMetadata({ form, channel, messageTs, submitterUserId }) {
  return JSON.stringify({
    edit: true,
    form,
    channel,
    messageTs,
    submitterUserId,
  });
}

function parseEditPrivateMetadata(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (
      data.edit &&
      data.form &&
      data.channel &&
      data.messageTs &&
      data.submitterUserId
    ) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

module.exports = { buildEditPrivateMetadata, parseEditPrivateMetadata };
