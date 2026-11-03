const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildReturnEquipmentModal } = require('../blocks/returnEquipmentModal');
const {
  formatPostBodyText,
  formatPostFallbackText,
} = require('../format/returnEquipmentMessage');
const { slackClient } = require('./delivery');
const { isUserAllowed } = require('./access');
const { formatViewsOpenError } = require('./truckSwitch');
const { ACTION_EDIT_RETURN_EQUIPMENT } = require('../constants/formEditActions');
const { buildEditPostActionsBlock } = require('../blocks/editPostActions');
const {
  createSimpleFormMetadata,
  RETURN_EQUIPMENT_FORM_EVENT,
  parseSimpleFormMetadata,
} = require('../util/simpleFormMetadata');
const { resolveSimpleFormEditStore } = require('../util/formEditContext');

function buildMeta(submitterUserId) {
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
  };
}

function buildPostBlocks(submission, meta) {
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatPostBodyText(submission, meta) },
    },
    buildEditPostActionsBlock(ACTION_EDIT_RETURN_EQUIPMENT),
  ];
}

async function openReturnEquipmentModal(triggerId) {
  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildReturnEquipmentModal(),
  });
}

async function notifyReturnEquipmentSubmissionFailed(userId, err) {
  const client = slackClient();
  const text = err?.message
    ? `Your return equipment form could not be posted. ${err.message}`
    : 'Your return equipment form could not be posted.';
  try {
    await client.chat.postMessage({ channel: userId, text });
  } catch (dmErr) {
    console.error('[returnEquipment] failed to DM submitter:', dmErr.message);
  }
}

async function updateReturnEquipmentPost(
  client,
  channel,
  messageTs,
  submission,
  submissionMeta
) {
  const meta = {
    submitterUserId: submissionMeta.submitterUserId,
    submittedAtIso: submissionMeta.submittedAtIso,
    lastEditedAtIso: new Date().toISOString(),
  };
  const metadata = createSimpleFormMetadata(
    RETURN_EQUIPMENT_FORM_EVENT,
    submission,
    submissionMeta
  );
  await client.chat.update({
    channel,
    ts: messageTs,
    text: formatPostFallbackText(submission, meta),
    blocks: buildPostBlocks(submission, meta),
    metadata,
  });
}

async function processReturnEquipmentSubmission(submission, submitterUserId) {
  const { returnEquipmentChannelId } = loadConfig().slack;
  console.log(
    `[returnEquipment] posting to channel ${returnEquipmentChannelId}`
  );
  const client = slackClient();
  const submissionMeta = buildMeta(submitterUserId);
  const meta = submissionMeta;
  const metadata = createSimpleFormMetadata(
    RETURN_EQUIPMENT_FORM_EVENT,
    submission,
    submissionMeta
  );

  try {
    await client.chat.postMessage({
      channel: returnEquipmentChannelId,
      text: formatPostFallbackText(submission, meta),
      blocks: buildPostBlocks(submission, meta),
      metadata,
    });
  } catch (err) {
    const code = err?.data?.error || '';
    if (code === 'not_in_channel') {
      throw new Error('Invite the bot to the channel, then submit again.');
    }
    if (code === 'channel_not_found') {
      throw new Error(
        'Return equipment channel is not a channel this bot can see.'
      );
    }
    throw new Error(code || err.message || 'Could not post to the Slack channel.');
  }
}

async function processReturnEquipmentEditSubmission(
  submission,
  userId,
  editCtx
) {
  const client = slackClient();
  const { submissionMeta } = await resolveSimpleFormEditStore(
    editCtx,
    userId,
    client,
    parseSimpleFormMetadata
  );

  await updateReturnEquipmentPost(
    client,
    editCtx.channel,
    editCtx.messageTs,
    submission,
    submissionMeta
  );
}

module.exports = {
  isUserAllowed,
  openReturnEquipmentModal,
  formatViewsOpenError,
  processReturnEquipmentSubmission,
  processReturnEquipmentEditSubmission,
  notifyReturnEquipmentSubmissionFailed,
};
