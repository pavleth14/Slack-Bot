const SLACK_PRIVATE_METADATA_LIMIT = 3000;

function buildEditPrivateMetadata({
  form,
  channel,
  messageTs,
  submitterUserId,
  submissionMeta,
  preserve,
  truckState,
}) {
  const payload = {
    edit: true,
    form,
    channel,
    messageTs,
    submitterUserId,
    submissionMeta: {
      submitterUserId: submissionMeta.submitterUserId,
      submittedAtIso: submissionMeta.submittedAtIso,
    },
  };

  if (truckState) {
    payload.truckState = truckState;
  } else if (preserve) {
    payload.preserve = {
      attachmentNames: preserve.attachmentNames || [],
    };
  }

  let json = JSON.stringify(payload);
  if (json.length > SLACK_PRIVATE_METADATA_LIMIT && payload.truckState) {
    const s = payload.truckState;
    payload.truckState = {
      submission: {
        ...s.submission,
        attachmentNames: s.submission?.attachmentNames || [],
      },
      checks: s.checks,
      emailMessageId: s.emailMessageId,
      emailSubject: s.emailSubject,
      workCompleteMailSent: s.workCompleteMailSent,
      submissionMeta: s.submissionMeta,
    };
    json = JSON.stringify(payload);
  }

  if (json.length > SLACK_PRIVATE_METADATA_LIMIT) {
    throw new Error(
      'Edit context too large for Slack. Shorten very long text fields and try again.'
    );
  }

  return json;
}

function parseEditPrivateMetadata(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (
      data.edit &&
      data.form &&
      data.channel &&
      data.messageTs &&
      data.submitterUserId
    ) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchChannelMessage(client, channel, messageTs) {
  const history = await client.conversations.history({
    channel,
    latest: messageTs,
    oldest: messageTs,
    inclusive: true,
    limit: 1,
  });
  return history.messages?.[0] || null;
}

function assertSubmitter(submissionMeta, userId) {
  if (submissionMeta.submitterUserId !== userId) {
    throw new Error('Only the submitter can edit this post.');
  }
}

async function resolveSimpleFormEditStore(editCtx, userId, client, parseFromMessage) {
  if (editCtx.submissionMeta?.submitterUserId) {
    assertSubmitter(editCtx.submissionMeta, userId);
    return {
      submissionMeta: editCtx.submissionMeta,
      attachmentNames: editCtx.preserve?.attachmentNames || [],
    };
  }

  const message = await fetchChannelMessage(
    client,
    editCtx.channel,
    editCtx.messageTs
  );
  const stored = parseFromMessage(message);
  if (!stored) {
    throw new Error('Could not read the post to update.');
  }
  assertSubmitter(stored.submissionMeta, userId);
  return {
    submissionMeta: stored.submissionMeta,
    attachmentNames: stored.submission?.attachmentNames || [],
  };
}

async function resolveTruckSwitchEditState(editCtx, userId, client, parsePostMetadata) {
  if (editCtx.truckState?.submissionMeta?.submitterUserId) {
    assertSubmitter(editCtx.truckState.submissionMeta, userId);
    return editCtx.truckState;
  }

  const message = await fetchChannelMessage(
    client,
    editCtx.channel,
    editCtx.messageTs
  );
  const state = parsePostMetadata(message);
  if (!state?.submissionMeta?.submitterUserId) {
    throw new Error('Could not read the post to update.');
  }
  assertSubmitter(state.submissionMeta, userId);
  return state;
}

module.exports = {
  SLACK_PRIVATE_METADATA_LIMIT,
  buildEditPrivateMetadata,
  parseEditPrivateMetadata,
  fetchChannelMessage,
  resolveSimpleFormEditStore,
  resolveTruckSwitchEditState,
};
