const crypto = require('crypto');
const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { isUserAllowed } = require('./access');
const { slackClient } = require('./delivery');
const { saveDot, loadDot } = require('./dotStore');
const { GROUP_BY_KEY } = require('../blocks/dotFields');
const { buildDotModal, parseSubmissionValues } = require('../blocks/dotModal');
const {
  buildDotBlocks,
  formatPostFallbackText,
  dotIdFromMessage,
} = require('../format/dotMessage');
const {
  chunkOptions,
  applyDotGroupSelection,
  parseDotSelectionActionId,
} = require('./dotSelection');
const {
  SlackFileError,
  downloadSlackFileBuffers,
  uploadFilesToThread,
} = require('./slackFiles');
const { formatViewsOpenError } = require('./truckSwitch');
const dotQueues = new Map();

function withDotLock(dotId, work) {
  const previous = dotQueues.get(dotId) || Promise.resolve();
  const run = previous.then(work, work);
  dotQueues.set(
    dotId,
    run.then(
      () => {},
      () => {}
    )
  );
  return run;
}

function seenSelectionFromMessage(message, action) {
  const blocks = message?.blocks || [];
  const block =
    blocks.find((item) => item.block_id && item.block_id === action?.block_id) ||
    blocks.find((item) => item.accessory?.action_id === action?.action_id);
  if (!block?.accessory) return null;
  return (block.accessory.initial_options || [])
    .map((option) => option.value)
    .filter(Boolean);
}

function makeDotId() {
  return `d${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

async function openDotModal(triggerId) {
  const { botToken, enableModalFileUpload } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildDotModal({ includeAttachments: enableModalFileUpload }),
  });
}

async function notifyDotSubmissionFailed(userId, err) {
  const client = slackClient();
  const text = err?.message
    ? `Your DOT inspection report could not be completed. ${err.message}`
    : 'Your DOT inspection report could not be completed.';
  try {
    await client.chat.postMessage({ channel: userId, text });
  } catch (dmErr) {
    console.error('[dot] failed to DM submitter:', dmErr.message);
  }
}

async function syncDotPost(client, channel, messageTs, record) {
  const { blocks } = buildDotBlocks(
    record.submission,
    record.meta,
    record.dotId,
    record.revision || 0
  );
  await client.chat.update({
    channel,
    ts: messageTs,
    text: formatPostFallbackText(record.submission),
    blocks,
    metadata: {
      event_type: 'dot_v1',
      event_payload: { dotId: record.dotId },
    },
  });
}

async function processDotSubmission(rawSubmission, submitterUserId) {
  const { dotChannelId } = loadConfig().slack;
  console.log(`[dot] posting to channel ${dotChannelId}`);
  const client = slackClient();
  const { attachmentFiles = [], ...formFields } = rawSubmission;

  let fileAttachments = [];
  try {
    fileAttachments = await downloadSlackFileBuffers(client, attachmentFiles);
  } catch (err) {
    if (err instanceof SlackFileError) {
      throw new Error(`Could not process inspection report files: ${err.message}`);
    }
    throw err;
  }

  const submission = {
    ...formFields,
    attachmentNames: fileAttachments.map((f) => f.filename),
  };

  const dotId = makeDotId();
  const meta = {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
  };
  const record = {
    dotId,
    submission,
    meta,
    revision: 0,
  };
  saveDot(dotId, record);

  const { blocks } = buildDotBlocks(submission, meta, dotId, 0);
  const text = formatPostFallbackText(submission);

  let post;
  try {
    post = await client.chat.postMessage({
      channel: dotChannelId,
      text,
      blocks,
      metadata: {
        event_type: 'dot_v1',
        event_payload: { dotId },
      },
    });
  } catch (err) {
    const code = err?.data?.error || '';
    if (code === 'not_in_channel') {
      throw new Error('Invite the bot to the DOT channel, then submit again.');
    }
    if (code === 'channel_not_found') {
      throw new Error('DOT channel is not a channel this bot can see.');
    }
    throw new Error(code || err.message || 'Could not post to the Slack channel.');
  }

  if (fileAttachments.length) {
    try {
      await uploadFilesToThread(
        client,
        post.channel,
        post.ts,
        fileAttachments,
        'DOT inspection report documents'
      );
    } catch (err) {
      console.error('[dot] thread file upload failed:', err.message);
    }
  }
}

async function processDotEditSubmission(formFields, userId, editCtx) {
  const client = slackClient();
  const dotId = editCtx.preserve?.dotId || editCtx.dotId;
  if (!dotId) {
    throw new Error('Could not read the post to update.');
  }
  if (editCtx.submissionMeta?.submitterUserId !== userId) {
    throw new Error('Only the submitter can edit this post.');
  }

  const record = loadDot(dotId);
  if (!record) {
    throw new Error('Could not read the post to update.');
  }
  if (record.meta.submitterUserId !== userId) {
    throw new Error('Only the submitter can edit this post.');
  }

  const { attachmentFiles: _ignored, ...fields } = formFields;
  record.submission = {
    ...fields,
    attachmentNames: record.submission.attachmentNames || [],
  };
  record.revision = (Number(record.revision) || 0) + 1;
  saveDot(dotId, record);

  await syncDotPost(client, editCtx.channel, editCtx.messageTs, record);
}

async function handleDotSelectionAction(payload) {
  const action = payload.actions?.[0];
  const parsed = parseDotSelectionActionId(action?.action_id);
  if (!parsed) return;

  const dotId = dotIdFromMessage(payload.message);
  if (!dotId || !loadDot(dotId)) {
    console.error('[dot] selection for unknown report', dotId || action?.action_id);
    return;
  }

  const group = GROUP_BY_KEY[parsed.key];
  if (!group) return;

  const seenSelected = seenSelectionFromMessage(payload.message, action);
  const clickedSelected = (action.selected_options || []).map((option) => option.value);
  const channel = payload.channel?.id || payload.container?.channel_id;
  const ts = payload.message?.ts || payload.container?.message_ts;
  if (!channel || !ts) return;

  await withDotLock(dotId, async () => {
    const record = loadDot(dotId);
    if (!record) return;
    const parts = chunkOptions(group.options);
    const partValues = (parts[parsed.part] || []).map((option) => option.value);
    record.submission[group.key] = applyDotGroupSelection(
      parsed.key,
      record.submission[group.key],
      partValues,
      seenSelected,
      clickedSelected
    );
    record.revision = (Number(record.revision) || 0) + 1;
    saveDot(dotId, record);
    await syncDotPost(slackClient(), channel, ts, record);
  });
}

function loadDotRecordFromMessage(message) {
  const dotId = dotIdFromMessage(message);
  if (!dotId) return null;
  const record = loadDot(dotId);
  if (!record?.meta?.submitterUserId) return null;
  return { ...record, form: 'dot' };
}

module.exports = {
  isUserAllowed,
  openDotModal,
  formatViewsOpenError,
  processDotSubmission,
  processDotEditSubmission,
  notifyDotSubmissionFailed,
  handleDotSelectionAction,
  loadDotRecordFromMessage,
};
