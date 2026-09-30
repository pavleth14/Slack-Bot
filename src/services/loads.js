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

function buildMeta(submitterUserId) {
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
  };
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

async function processLoadsSubmission(submission, submitterUserId) {
  const { loadsChannelId } = loadConfig().slack;
  console.log(`[loads] posting to channel ${loadsChannelId}`);
  const client = slackClient();
  const meta = buildMeta(submitterUserId);
  const fallback = formatPostFallbackText(submission, meta);

  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatPostBodyText(submission, meta) },
    },
  ];

  await deliverSlackAndEmail(
    async () => {
      await client.chat.postMessage({
        channel: loadsChannelId,
        text: fallback,
        blocks,
      });
      return {};
    },
    submission,
    meta,
    { sendEmail: sendLoadsEmail }
  );
}

module.exports = {
  isUserAllowed,
  openLoadsModal,
  formatViewsOpenError,
  processLoadsSubmission,
  notifyLoadsSubmissionFailed,
};
