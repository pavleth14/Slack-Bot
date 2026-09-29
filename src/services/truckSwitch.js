const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildTruckSwitchModal } = require('../blocks/truckSwitchModal');
const { deliverSlackAndEmail, DeliveryError, slackClient } = require('./delivery');
const {
  SlackFileError,
  downloadSlackFileBuffers,
  uploadFilesToThread,
} = require('./slackFiles');
const { isUserAllowed } = require('./access');
const { sendTruckSwitchReplyEmail } = require('./mail');
const {
  createPostMetadata,
  parsePostMetadata,
  allSystemsUpdated,
  buildInteractiveBlocks,
  buildPostFallbackText,
} = require('./interactivePost');
const {
  CHECK_ACTIONS,
  REVERT_ACTIONS,
  ACTION_TO_SYSTEM,
  ACTION_TO_SYSTEM_REVERT,
} = require('../constants/actions');
const { buildConfirmModal, parsePrivateMetadata } = require('../blocks/truckSwitchConfirmModal');
const {
  canUserActOnSystem,
  teamLabelForSystem,
} = require('./systemTeamAccess');

function buildMeta(submitterUserId, extra = {}) {
  const { safetyTeamUsergroupId, maintenanceTeamUsergroupId } = loadConfig().slack;
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
    safetyTeamUsergroupId,
    maintenanceTeamUsergroupId,
    ...extra,
  };
}

function formatViewsOpenError(err) {
  const meta = err?.data?.response_metadata?.messages;
  if (Array.isArray(meta) && meta.length) {
    return meta.join(' ');
  }
  return err?.data?.error || err?.message || 'unknown error';
}

async function openTruckSwitchModal(triggerId) {
  const { botToken, enableModalFileUpload } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildTruckSwitchModal({ includeAttachments: enableModalFileUpload }),
  });
}

async function notifySubmissionFailed(userId, err) {
  const client = slackClient();
  let text =
    'Your truck switch could not be completed. Nothing was posted to the channel.';
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
    console.error('[truckSwitch] failed to DM submitter:', dmErr.message);
  }
}

async function processTruckSwitchSubmission(rawSubmission, submitterUserId) {
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
  const metadata = createPostMetadata(submission, {
    submissionMeta: {
      submitterUserId,
      submittedAtIso: meta.submittedAtIso,
    },
  });
  const payload = metadata.event_payload;
  const blocks = buildInteractiveBlocks(submission, meta, payload);
  const text = buildPostFallbackText(submission, meta, payload);

  let postRef;

  const mailResult = await deliverSlackAndEmail(
    async () => {
      const post = await client.chat.postMessage({
        channel: channelId,
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
    { phase: 1, attachments: fileAttachments }
  );

  try {
    await uploadFilesToThread(
      client,
      postRef.channel,
      postRef.ts,
      fileAttachments,
      'Attachments from truck switch form'
    );
  } catch (err) {
    console.error('[truckSwitch] thread file upload failed:', err.message);
  }

  payload.emailMessageId = mailResult.messageId;
  payload.emailSubject = mailResult.subject;
  const updatedMetadata = createPostMetadata(submission, {
    emailMessageId: mailResult.messageId,
    emailSubject: mailResult.subject,
  });

  await client.chat.update({
    channel: postRef.channel,
    ts: postRef.ts,
    text: buildPostFallbackText(submission, meta, payload),
    blocks: buildInteractiveBlocks(submission, meta, payload),
    metadata: updatedMetadata,
  });
}

function buildStateMeta(state, actorUserId) {
  return buildMeta(state.submissionMeta?.submitterUserId || actorUserId, {
    submittedAtIso:
      state.submissionMeta?.submittedAtIso || new Date().toISOString(),
  });
}

async function postEphemeral(client, payload, text) {
  const channel = payload.channel?.id;
  const user = payload.user?.id;
  if (!channel || !user) {
    return;
  }
  try {
    await client.chat.postEphemeral({ channel, user, text });
  } catch (err) {
    console.error('[truckSwitch] postEphemeral failed:', err.message);
  }
}

async function syncPostMessage(client, channel, messageTs, state) {
  const submission = state.submission;
  const meta = buildStateMeta(state, state.submissionMeta?.submitterUserId || '');
  const metadata = {
    event_type: 'truck_switch_v1',
    event_payload: state,
  };
  await client.chat.update({
    channel,
    ts: messageTs,
    text: buildPostFallbackText(submission, meta, state),
    blocks: buildInteractiveBlocks(submission, meta, state),
    metadata,
  });
}

async function maybeSendWorkCompleteEmail(client, channel, messageTs, state) {
  if (!allSystemsUpdated(state.checks) || state.workCompleteMailSent) {
    return;
  }
  if (!state.emailMessageId || !state.emailSubject) {
    return;
  }

  const submission = state.submission;
  const meta = buildStateMeta(state, state.submissionMeta?.submitterUserId || '');

  try {
    const replySubject = /^Re:/i.test(state.emailSubject)
      ? state.emailSubject
      : `Re: ${state.emailSubject}`;
    const replyResult = await sendTruckSwitchReplyEmail(submission, meta, {
      inReplyTo: state.emailMessageId,
      references: state.emailMessageId,
      subject: replySubject,
      checks: state.checks,
    });
    if (!replyResult.sent) {
      console.error('[truckSwitch] work-complete reply email failed:', replyResult.reason);
      return;
    }
    state.workCompleteMailSent = true;
    await syncPostMessage(client, channel, messageTs, state);
  } catch (err) {
    console.error('[truckSwitch] work-complete reply email failed:', err.message);
  }
}

async function openSystemConfirmModal(client, triggerId, params) {
  await client.views.open({
    trigger_id: triggerId,
    view: buildConfirmModal(params),
  });
}

function snapshotPostState(state) {
  return {
    submission: state.submission,
    checks: { ...state.checks },
    emailMessageId: state.emailMessageId,
    emailSubject: state.emailSubject,
    workCompleteMailSent: state.workCompleteMailSent,
    submissionMeta: state.submissionMeta,
  };
}

async function handleSystemMarkAction(payload) {
  const action = payload.actions?.[0];
  const actionId = action?.action_id;

  if (!CHECK_ACTIONS.has(actionId)) {
    return;
  }

  const client = slackClient();
  const userId = payload.user?.id;
  const channel = payload.channel?.id;
  const messageTs = payload.message?.ts;
  const triggerId = payload.trigger_id;

  const state = parsePostMetadata(payload.message);
  if (!state) {
    await postEphemeral(client, payload, 'Could not read switch state.');
    return;
  }

  const systemKey = ACTION_TO_SYSTEM[actionId];
  if (state.checks[systemKey]) {
    await postEphemeral(client, payload, 'This system is already marked UPDATED.');
    return;
  }

  if (!(await canUserActOnSystem(userId, systemKey, client))) {
    await postEphemeral(
      client,
      payload,
      `Only ${teamLabelForSystem(systemKey)} can mark this system updated.`
    );
    return;
  }

  if (!triggerId) {
    await postEphemeral(
      client,
      payload,
      'Could not open confirmation (missing trigger). Try again.'
    );
    return;
  }

  try {
    await openSystemConfirmModal(client, triggerId, {
      channel,
      messageTs,
      systemKey,
      intent: 'check',
      actorUserId: userId,
      postState: snapshotPostState(state),
    });
  } catch (err) {
    console.error('[truckSwitch] confirm modal open failed:', err.message, err.data || '');
    await postEphemeral(client, payload, 'Could not open confirmation. Try again.');
  }
}

async function handleSystemRevertAction(payload) {
  const action = payload.actions?.[0];
  const actionId = action?.action_id;

  if (!REVERT_ACTIONS.has(actionId)) {
    return;
  }

  const client = slackClient();
  const userId = payload.user?.id;
  const channel = payload.channel?.id;
  const messageTs = payload.message?.ts;
  const triggerId = payload.trigger_id;

  const state = parsePostMetadata(payload.message);
  if (!state) {
    await postEphemeral(client, payload, 'Could not read switch state.');
    return;
  }

  const systemKey = ACTION_TO_SYSTEM_REVERT[actionId];
  if (!state.checks[systemKey]) {
    await postEphemeral(client, payload, 'This system is not marked UPDATED.');
    return;
  }

  if (!(await canUserActOnSystem(userId, systemKey, client))) {
    await postEphemeral(
      client,
      payload,
      `Only ${teamLabelForSystem(systemKey)} can revert this system.`
    );
    return;
  }

  if (!triggerId) {
    await postEphemeral(client, payload, 'Could not open confirmation. Try again.');
    return;
  }

  try {
    await openSystemConfirmModal(client, triggerId, {
      channel,
      messageTs,
      systemKey,
      intent: 'revert',
      actorUserId: userId,
      postState: snapshotPostState(state),
    });
  } catch (err) {
    console.error('[truckSwitch] revert confirm modal open failed:', err.message, err.data || '');
    await postEphemeral(client, payload, 'Could not open confirmation. Try again.');
  }
}

async function handleTruckSwitchConfirmSubmission(payload) {
  const userId = payload.user?.id;
  const meta = parsePrivateMetadata(payload.view?.private_metadata);
  if (!meta) {
    return { ok: false, error: 'Invalid confirmation data.' };
  }

  if (meta.actorUserId && meta.actorUserId !== userId) {
    return { ok: false, error: 'Confirmation must be completed by the same user.' };
  }

  const client = slackClient();
  const { channel, messageTs, systemKey, intent } = meta;

  if (!(await canUserActOnSystem(userId, systemKey, client))) {
    return {
      ok: false,
      error: `Only ${teamLabelForSystem(systemKey)} can perform this action.`,
    };
  }

  let state = null;

  try {
    const history = await client.conversations.history({
      channel,
      latest: messageTs,
      oldest: messageTs,
      inclusive: true,
      limit: 1,
    });
    state = parsePostMetadata(history.messages?.[0]);
  } catch (err) {
    console.error('[truckSwitch] fetch message failed:', err.message);
  }

  if (!state && meta.postState?.submission) {
    state = {
      ...meta.postState,
      checks: { ...meta.postState.checks },
    };
  }

  if (!state) {
    return { ok: false, error: 'Could not read switch state.' };
  }

  if (intent === 'check') {
    if (state.checks[systemKey]) {
      return { ok: false, error: 'This system is already marked UPDATED.' };
    }
    state.checks[systemKey] = userId;
  } else if (intent === 'revert') {
    if (!state.checks[systemKey]) {
      return { ok: false, error: 'This system is not marked UPDATED.' };
    }
    state.checks[systemKey] = null;
    if (!allSystemsUpdated(state.checks)) {
      state.workCompleteMailSent = false;
    }
  } else {
    return { ok: false, error: 'Unknown action.' };
  }

  await syncPostMessage(client, channel, messageTs, state);
  await maybeSendWorkCompleteEmail(client, channel, messageTs, state);

  return { ok: true };
}

module.exports = {
  DeliveryError,
  isUserAllowed,
  openTruckSwitchModal,
  formatViewsOpenError,
  processTruckSwitchSubmission,
  notifySubmissionFailed,
  handleSystemMarkAction,
  handleSystemRevertAction,
  handleTruckSwitchConfirmSubmission,
};
