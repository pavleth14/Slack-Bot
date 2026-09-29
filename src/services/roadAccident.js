const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildRoadAccidentModal } = require('../blocks/roadAccidentModal');
const { formatPostBodyText } = require('../format/roadAccidentMessage');
const { deliverSlackAndEmail, DeliveryError, slackClient } = require('./delivery');
const { sendRoadAccidentEmail } = require('./mail');
const { isUserAllowed } = require('./access');
const {
  SlackFileError,
  downloadSlackFileBuffers,
  uploadFilesToThread,
} = require('./slackFiles');
const { formatViewsOpenError } = require('./truckSwitch');

function buildMeta(submitterUserId) {
  const { safetyTeamUsergroupId } = loadConfig().slack;
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
    safetyTeamUsergroupId,
  };
}

async function openRoadAccidentModal(triggerId) {
  const { botToken, enableModalFileUpload } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildRoadAccidentModal({ includeAttachments: enableModalFileUpload }),
  });
}

async function notifyAccidentSubmissionFailed(userId, err) {
  const client = slackClient();
  let text =
    'Your road accident report could not be completed. Nothing was posted to the channel.';
  if (err instanceof DeliveryError) {
    if (err.mailFailed) {
      text =
        'Email could not be sent. The channel post was rolled back. Fix email settings or try again.';
    } else if (err.slackFailed) {
      text = 'Could not post to the Slack channel. Check bot channel access and try again.';
    } else if (err.fileFailed) {
      text =
        'Could not process attached photos. Reinstall the app with files:read (and files:write) scopes, or try again without attachments.';
    }
  } else if (err instanceof SlackFileError) {
    text = `Could not process attached photos: ${err.message}`;
  } else if (err?.message) {
    text = err.message;
  }

  try {
    await client.chat.postMessage({ channel: userId, text });
  } catch (dmErr) {
    console.error('[roadAccident] failed to DM submitter:', dmErr.message);
  }
}

async function processRoadAccidentSubmission(rawSubmission, submitterUserId) {
  const { channelId } = loadConfig().slack;
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
  const text = formatPostBodyText(submission, meta);
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];

  let postRef;

  await deliverSlackAndEmail(
    async () => {
      const post = await client.chat.postMessage({
        channel: channelId,
        text,
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
      sendEmail: sendRoadAccidentEmail,
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
        'Photos from road accident report'
      );
    } catch (err) {
      console.error('[roadAccident] thread photo upload failed:', err.message);
    }
  }
}

module.exports = {
  isUserAllowed,
  openRoadAccidentModal,
  formatViewsOpenError,
  processRoadAccidentSubmission,
  notifyAccidentSubmissionFailed,
};
