const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildLoadsModal } = require('../blocks/loadsModal');
const {
  formatPostBodyText,
  formatPostFallbackText,
} = require('../format/loadsMessage');
const { deliverSlackAndEmail, DeliveryError, slackClient } = require('./delivery');
const { sendLoadsEmail } = require('./mail');
const { isUserAllowed } = require('./access');
const { formatViewsOpenError } = require('./truckSwitch');
const { ACTION_EDIT_LOADS } = require('../constants/formEditActions');
const { buildEditPostActionsBlock } = require('../blocks/editPostActions');
const {
  createSimpleFormMetadata,
  LOADS_FORM_EVENT,
  parseSimpleFormMetadata,
} = require('../util/simpleFormMetadata');

function buildMeta(submitterUserId, extra = {}) {
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
    ...extra,
  };
}

function buildLoadsSlackBlocks(submission, meta) {
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatPostBodyText(submission, meta) },
    },
    buildEditPostActionsBlock(ACTION_EDIT_LOADS),
  ];
}

async function openLoadsModal(triggerId) {
  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildLoadsModal(),
  });
}

async function notifyLoadsSubmissionFailed(userId, err) {
  const client = slackClient();
  let text =
    'Your load could not be posted. Nothing was sent to the channel.';
  if (err instanceof DeliveryError) {
    if (err.mailFailed) {
      text =
        'Email could not be sent. The channel post was rolled back. Fix email settings or try again.';
    } else if (err.slackFailed) {
      text = 'Could not post to the Slack channel. Check bot channel access and try again.';
    }
  } else if (err?.message) {
    text = err.message;
  }

  try {
    await client.chat.postMessage({ channel: userId, text });
  } catch (dmErr) {
    console.error('[loads] failed to DM submitter:', dmErr.message);
  }
}

async function fetchMessage(client, channel, messageTs) {
  const history = await client.conversations.history({
    channel,
    latest: messageTs,
    oldest: messageTs,
    inclusive: true,
    limit: 1,
  });
  return history.messages?.[0] || null;
}

async function updateLoadsPost(client, channel, messageTs, submission, submissionMeta) {
  const meta = {
    submitterUserId: submissionMeta.submitterUserId,
    submittedAtIso: submissionMeta.submittedAtIso,
    lastEditedAtIso: new Date().toISOString(),
  };
  const metadata = createSimpleFormMetadata(
    LOADS_FORM_EVENT,
    submission,
    submissionMeta
  );
  await client.chat.update({
    channel,
    ts: messageTs,
    text: formatPostFallbackText(submission, meta),
    blocks: buildLoadsSlackBlocks(submission, meta),
    metadata,
  });
}

async function processLoadsSubmission(submission, submitterUserId) {
  const { loadsChannelId } = loadConfig().slack;
  console.log(`[loads] posting to channel ${loadsChannelId}`);
  const client = slackClient();
  const submissionMeta = buildMeta(submitterUserId);
  const meta = submissionMeta;
  const fallback = formatPostFallbackText(submission, meta);
  const blocks = buildLoadsSlackBlocks(submission, meta);
  const metadata = createSimpleFormMetadata(
    LOADS_FORM_EVENT,
    submission,
    submissionMeta
  );

  await deliverSlackAndEmail(
    async () => {
      await client.chat.postMessage({
        channel: loadsChannelId,
        text: fallback,
        blocks,
        metadata,
      });
      return {};
    },
    submission,
    meta,
    { sendEmail: sendLoadsEmail }
  );
}

async function processLoadsEditSubmission(submission, userId, editCtx) {
  const client = slackClient();
  const message = await fetchMessage(client, editCtx.channel, editCtx.messageTs);
  const stored = parseSimpleFormMetadata(message);
  if (!stored) {
    throw new Error('Could not read the post to update.');
  }
  if (stored.submissionMeta.submitterUserId !== userId) {
    throw new Error('Only the submitter can edit this post.');
  }

  await updateLoadsPost(
    client,
    editCtx.channel,
    editCtx.messageTs,
    submission,
    stored.submissionMeta
  );
}

module.exports = {
  isUserAllowed,
  openLoadsModal,
  formatViewsOpenError,
  processLoadsSubmission,
  processLoadsEditSubmission,
  notifyLoadsSubmissionFailed,
};
