const { loadConfig } = require('../config');

class SlackFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SlackFileError';
    this.fileFailed = true;
  }
}

/**
 * @param {import('@slack/web-api').WebClient} client
 * @param {{ id: string, name?: string }[]} fileRefs
 * @returns {Promise<{ filename: string, content: Buffer, contentType?: string }[]>}
 */
async function downloadSlackFileBuffers(client, fileRefs) {
  if (!fileRefs?.length) {
    return [];
  }

  const { botToken } = loadConfig().slack;
  const results = [];

  for (const ref of fileRefs) {
    let info;
    try {
      info = await client.files.info({ file: ref.id });
    } catch (err) {
      throw new SlackFileError(
        err.message || `Could not read file ${ref.name || ref.id}.`
      );
    }

    const file = info.file;
    const url = file?.url_private_download || file?.url_private;
    if (!url) {
      throw new SlackFileError(`Cannot download ${ref.name || file?.name || 'attachment'}.`);
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    if (!res.ok) {
      throw new SlackFileError(
        `Download failed for ${file.name || ref.name} (HTTP ${res.status}).`
      );
    }

    const content = Buffer.from(await res.arrayBuffer());
    results.push({
      filename: file.name || ref.name || 'attachment',
      content,
      contentType: file.mimetype,
    });
  }

  return results;
}

/**
 * @param {import('@slack/web-api').WebClient} client
 * @param {string} channelId
 * @param {string} threadTs
 * @param {{ filename: string, content: Buffer }[]} files
 */
async function uploadFilesToThread(client, channelId, threadTs, files) {
  if (!files?.length) {
    return;
  }

  await client.files.uploadV2({
    channel_id: channelId,
    thread_ts: threadTs,
    initial_comment: 'Attachments from truck switch form',
    file_uploads: files.map((f) => ({
      file: f.content,
      filename: f.filename,
    })),
  });
}

module.exports = {
  SlackFileError,
  downloadSlackFileBuffers,
  uploadFilesToThread,
};
