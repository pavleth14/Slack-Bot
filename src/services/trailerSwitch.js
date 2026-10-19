const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildTrailerSwitchModal } = require('../blocks/trailerSwitchModal');
const {
  formatPostBodyText,
  formatPostFallbackText,
} = require('../format/trailerSwitchMessage');
const { DeliveryError, slackClient } = require('./delivery');
const { sendTrailerSwitchEmail, sendTrailerSwitchReplyEmail } = require('./mail');
const { isUserAllowed } = require('./access');
const {
  SlackFileError,
  downloadSlackFileBuffers,
  uploadFilesToThread,
} = require('./slackFiles');
const { prepareEmailAttachments } = require('./videoCompress');
const { formatViewsOpenError } = require('./truckSwitch');
const { ACTION_EDIT_TRAILER_SWITCH } = require('../constants/formEditActions');
const { buildEditPostActionsBlock } = require('../blocks/editPostActions');
const {
  createSimpleFormMetadata,
  TRAILER_SWITCH_FORM_EVENT,
  parseSimpleFormMetadata,
} = require('../util/simpleFormMetadata');
const { resolveSimpleFormEditStore } = require('../util/formEditContext');

function buildMeta(submitterUserId, extra = {}) {
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
    ...extra,
  };
}

function buildTrailerSlackBlocks(submission, meta) {
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatPostBodyText(submission, meta) },
    },
    buildEditPostActionsBlock(ACTION_EDIT_TRAILER_SWITCH),
  ];
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
        'The channel post was saved, but email could not be sent. Check email settings or try again.';
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

async function notifyTrailerSwitchEmailFailed(userId, err) {
  const client = slackClient();
  const detail = err?.message ? ` ${err.message}` : '';
  const text = `Your trailer switch was posted to the channel, but email failed.${detail} The original files are in the Slack thread.`;
  try {
    await client.chat.postMessage({ channel: userId, text });
  } catch (dmErr) {
    console.error('[trailerSwitch] failed to DM email failure:', dmErr.message);
  }
}

function trailerSubmissionMetaRecord(submissionMeta) {
  return {
    submitterUserId: submissionMeta.submitterUserId,
    submittedAtIso: submissionMeta.submittedAtIso,
    emailMessageId: submissionMeta.emailMessageId || undefined,
    emailSubject: submissionMeta.emailSubject || undefined,
    ...(submissionMeta.lastEditedAtIso && {
      lastEditedAtIso: submissionMeta.lastEditedAtIso,
    }),
  };
}

async function updateTrailerSwitchPost(
  client,
  channel,
  messageTs,
  submission,
  submissionMeta
) {
  const record = trailerSubmissionMetaRecord({
    ...submissionMeta,
    lastEditedAtIso: new Date().toISOString(),
  });
  const meta = {
    submitterUserId: record.submitterUserId,
    submittedAtIso: record.submittedAtIso,
    lastEditedAtIso: record.lastEditedAtIso,
  };
  const metadata = createSimpleFormMetadata(
    TRAILER_SWITCH_FORM_EVENT,
    submission,
    record
  );
  await client.chat.update({
    channel,
    ts: messageTs,
    text: formatPostFallbackText(submission, meta),
    blocks: buildTrailerSlackBlocks(submission, meta),
    metadata,
  });
}

async function processTrailerSwitchSubmission(rawSubmission, submitterUserId) {
  const { trailerSwitchChannelId } = loadConfig().slack;
  const { mail } = loadConfig();
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

  const submissionMeta = buildMeta(submitterUserId);
  const meta = submissionMeta;
  const fallback = formatPostFallbackText(submission, meta);
  const blocks = buildTrailerSlackBlocks(submission, meta);
  const metadata = createSimpleFormMetadata(
    TRAILER_SWITCH_FORM_EVENT,
    submission,
    submissionMeta
  );

  let postRef;
  try {
    postRef = await client.chat.postMessage({
      channel: trailerSwitchChannelId,
      text: fallback,
      blocks,
      metadata,
    });
  } catch (err) {
    throw new DeliveryError(
      err.message || 'Could not post to Slack channel.',
      { slackFailed: true }
    );
  }

  // Original files always go to Slack first (never blocked by email/compress).
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

  if (!mail.enabled) {
    return;
  }

  // Compress large videos for Gmail in the background of this job; do not delete the Slack post on failure.
  try {
    const { attachments, notes } = await prepareEmailAttachments(
      fileAttachments,
      mail.gmailAttachmentMaxBytes
    );
    const mailResult = await sendTrailerSwitchEmail(submission, meta, {
      attachments,
      attachmentNotes: notes,
    });
    if (!mailResult.sent) {
      throw new Error(mailResult.reason || 'email_not_sent');
    }
    submissionMeta.emailMessageId = mailResult.messageId;
    submissionMeta.emailSubject = mailResult.subject;
    await client.chat.update({
      channel: postRef.channel,
      ts: postRef.ts,
      text: fallback,
      blocks,
      metadata: createSimpleFormMetadata(
        TRAILER_SWITCH_FORM_EVENT,
        submission,
        trailerSubmissionMetaRecord(submissionMeta)
      ),
    });
  } catch (err) {
    console.error('[trailerSwitch] email failed (Slack post kept):', err.message);
    await notifyTrailerSwitchEmailFailed(submitterUserId, err);
  }
}

async function processTrailerSwitchEditSubmission(formFields, userId, editCtx) {
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

  await updateTrailerSwitchPost(
    client,
    editCtx.channel,
    editCtx.messageTs,
    submission,
    submissionMeta
  );

  await maybeSendTrailerEditReplyEmail(submission, submissionMeta);
}

async function maybeSendTrailerEditReplyEmail(submission, submissionMeta) {
  const { mail } = loadConfig();
  if (!mail.enabled) return;
  if (!submissionMeta.emailMessageId || !submissionMeta.emailSubject) return;

  const displayMeta = {
    submitterUserId: submissionMeta.submitterUserId,
    submittedAtIso: submissionMeta.submittedAtIso,
  };
  const subject = /^Re:/i.test(submissionMeta.emailSubject)
    ? submissionMeta.emailSubject
    : `Re: ${submissionMeta.emailSubject}`;

  try {
    const result = await sendTrailerSwitchReplyEmail(submission, displayMeta, {
      inReplyTo: submissionMeta.emailMessageId,
      references: submissionMeta.emailMessageId,
      subject,
    });
    if (!result.sent) {
      console.error('[trailerSwitch] edit reply email failed:', result.reason);
    }
  } catch (err) {
    console.error('[trailerSwitch] edit reply email failed:', err.message);
  }
}

module.exports = {
  isUserAllowed,
  openTrailerSwitchModal,
  formatViewsOpenError,
  processTrailerSwitchSubmission,
  processTrailerSwitchEditSubmission,
  notifyTrailerSwitchSubmissionFailed,
};
