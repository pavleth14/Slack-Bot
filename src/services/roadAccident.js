const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildRoadAccidentModal } = require('../blocks/roadAccidentModal');
const {
  formatPostBodyText,
  buildAccidentSlackBlocks,
} = require('../format/roadAccidentMessage');
const { ACTION_EDIT_ACCIDENT } = require('../constants/formEditActions');
const { buildEditPostActionsBlock } = require('../blocks/editPostActions');
const {
  createSimpleFormMetadata,
  ACCIDENT_FORM_EVENT,
  parseSimpleFormMetadata,
} = require('../util/simpleFormMetadata');
const { resolveSimpleFormEditStore } = require('../util/formEditContext');
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

function buildAccidentPostBlocks(submission, meta) {
  return [...buildAccidentSlackBlocks(submission, meta), buildEditPostActionsBlock(ACTION_EDIT_ACCIDENT)];
}

async function updateAccidentPost(client, channel, messageTs, submission, submissionMeta) {
  const meta = {
    ...buildMeta(submissionMeta.submitterUserId),
    submittedAtIso: submissionMeta.submittedAtIso,
    lastEditedAtIso: new Date().toISOString(),
  };
  const metadata = createSimpleFormMetadata(
    ACCIDENT_FORM_EVENT,
    submission,
    submissionMeta
  );
  const text = formatPostBodyText(submission, meta);
  await client.chat.update({
    channel,
    ts: messageTs,
    text,
    blocks: buildAccidentPostBlocks(submission, meta),
    metadata,
  });
}

async function processRoadAccidentEditSubmission(formFields, userId, editCtx) {
  const client = slackClient();
  const { submissionMeta, attachmentNames } = await resolveSimpleFormEditStore(
    editCtx,
    userId,
    client,
    parseSimpleFormMetadata
  );

  const submission = {
    ...formFields,
    attachmentNames,
  };

  await updateAccidentPost(
    client,
    editCtx.channel,
    editCtx.messageTs,
    submission,
    submissionMeta
  );
}

async function processRoadAccidentSubmission(rawSubmission, submitterUserId) {
  const { accidentsChannelId } = loadConfig().slack;
  console.log(`[roadAccident] posting to channel ${accidentsChannelId}`);
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

  const submissionMeta = {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
  };
  const meta = buildMeta(submitterUserId);
  const text = formatPostBodyText(submission, meta);
  const blocks = buildAccidentPostBlocks(submission, meta);
  const metadata = createSimpleFormMetadata(
    ACCIDENT_FORM_EVENT,
    submission,
    submissionMeta
  );

  let postRef;

  await deliverSlackAndEmail(
    async () => {
      const post = await client.chat.postMessage({
        channel: accidentsChannelId,
        text,
        blocks,
        metadata,
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
  processRoadAccidentEditSubmission,
  notifyAccidentSubmissionFailed,
};
