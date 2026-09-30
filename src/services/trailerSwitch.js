const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildTrailerSwitchModal } = require('../blocks/trailerSwitchModal');
const {
  formatPostBodyText,
  formatPostFallbackText,
} = require('../format/trailerSwitchMessage');
const { deliverSlackAndEmail, DeliveryError, slackClient } = require('./delivery');
const { sendTrailerSwitchEmail } = require('./mail');
const { isUserAllowed } = require('./access');
const {
  SlackFileError,
  downloadSlackFileBuffers,
  uploadFilesToThread,
} = require('./slackFiles');
const { formatViewsOpenError } = require('./truckSwitch');

function buildMeta(submitterUserId) {
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
  };
}

async function openTrailerSwitchModal(triggerId) {
  const { botToken, enableModalFileUpload } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildTrailerSwitchModal({ includeAttachments: enableModalFileUpload }),
  });
}

async function notifyTrailerSwitchSubmissionFailed(userId, err) {
  const client = slackClient();
  let text =
    'Your trailer switch could not be posted. Nothing was sent to the channel.';
  if (err instanceof DeliveryError) {
    if (err.mailFailed) {
      text =
        'Email could not be sent. The channel post was rolled back. Fix email settings or try again.';
    } else if (err.slackFailed) {
      text = 'Could not post to the Slack channel. Check bot channel access and try again.';
    } else if (err.fileFailed) {
      text =
        'Could not process attached files. Reinstall the app with files:read (and files:write) scopes, or try again without attachments.';
    }
  } else if (err instanceof SlackFileError) {
    text = `Could not process attached files: ${err.message}`;
  } else if (err?.message) {
    text = err.message;
  }

  try {
    await client.chat.postMessage({ channel: userId, text });
  } catch (dmErr) {
    console.error('[trailerSwitch] failed to DM submitter:', dmErr.message);
  }
}

async function processTrailerSwitchSubmission(rawSubmission, submitterUserId) {
  const { trailerSwitchChannelId } = loadConfig().slack;
  console.log(`[trailerSwitch] posting to channel ${trailerSwitchChannelId}`);
  const client = slackClient();
  const { attachmentFiles = [], ...formFields } = rawSubmission;

  let fileAttachments = [];
  try {
    fileAttachments = await downloadSlackFileBuffers(client, attachmentFiles);
  } catch (err) {
    if (err instanceof SlackFileError) {
      throw new DeliveryError(err.message, { fileFailed: true });
    }
    throw err;
  }

  const submission = {
    ...formFields,
    attachmentNames: fileAttachments.map((f) => f.filename),
  };

  const meta = buildMeta(submitterUserId);
  const fallback = formatPostFallbackText(submission, meta);
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatPostBodyText(submission, meta) },
    },
  ];

  let postRef;

  await deliverSlackAndEmail(
    async () => {
      const post = await client.chat.postMessage({
        channel: trailerSwitchChannelId,
        text: fallback,
        blocks,
      });
      postRef = post;
      return {
        rollback: async () => {
          await client.chat.delete({
            channel: post.channel,
            ts: post.ts,
          });
        },
      };
    },
    submission,
    meta,
    {
      sendEmail: sendTrailerSwitchEmail,
      attachments: fileAttachments,
    }
  );

  if (fileAttachments.length) {
    try {
      await uploadFilesToThread(
        client,
        postRef.channel,
        postRef.ts,
        fileAttachments,
        'Attachments from trailer switch form'
      );
    } catch (err) {
      console.error('[trailerSwitch] thread file upload failed:', err.message);
    }
  }
}

module.exports = {
  isUserAllowed,
  openTrailerSwitchModal,
  formatViewsOpenError,
  processTrailerSwitchSubmission,
  notifyTrailerSwitchSubmissionFailed,
};
