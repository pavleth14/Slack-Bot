const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildTruckSwitchModal } = require('../blocks/truckSwitchModal');
const { buildCompleteModal } = require('../blocks/completeModal');
const { buildRejectModal } = require('../blocks/rejectModal');
const {
  formatPhase1Message,
  formatPhase2ThreadMessage,
} = require('../format/truckSwitchMessage');
const {
  ACTION_MARK_COMPLETE,
  ACTION_CONTROL_CONFIRM,
  ACTION_CONTROL_REJECT,
} = require('../constants/actions');
const { deliverSlackAndEmail, DeliveryError, slackClient } = require('./delivery');

function isUserAllowed(userId) {
  const { allowedUserIds } = loadConfig().slack;
  if (!allowedUserIds.length) return true;
  return allowedUserIds.includes(userId);
}

function isSafetyOperator(userId) {
  const { safetyAllowedUserIds } = loadConfig().slack;
  if (!safetyAllowedUserIds.length) return true;
  return safetyAllowedUserIds.includes(userId);
}

function isControlOperator(userId) {
  const { controlAllowedUserIds } = loadConfig().slack;
  if (!controlAllowedUserIds.length) return true;
  return controlAllowedUserIds.includes(userId);
}

function buildMeta(submitterUserId, extra = {}) {
  const {
    safetyTeamUsergroupId,
    controlTeamUsergroupId,
  } = loadConfig().slack;
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
    safetyTeamUsergroupId,
    controlTeamUsergroupId,
    ...extra,
  };
}

function encodeSubmission(submission) {
  return JSON.stringify(submission);
}

function decodeSubmission(value) {
  return JSON.parse(value);
}

function buildPhase1Blocks(submission, meta) {
  const text = formatPhase1Message(submission, meta);
  return [
    { type: 'section', text: { type: 'mrkdwn', text } },
    {
      type: 'actions',
      block_id: 'phase1_actions',
      elements: [
        {
          type: 'button',
          action_id: ACTION_MARK_COMPLETE,
          text: { type: 'plain_text', text: 'Mark work completed' },
          value: encodeSubmission(submission),
        },
      ],
    },
  ];
}

function buildPhase2Blocks(submission, updateFlags, meta, { verified, rejectedBy, rejectReason } = {}) {
  const text = formatPhase2ThreadMessage(submission, updateFlags, meta);
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text } }];

  if (verified) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `:white_check_mark: *Verified* by <@${verified}>`,
        },
      ],
    });
  } else if (rejectedBy) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `:x: *Rejected* by <@${rejectedBy}>: ${rejectReason}`,
        },
      ],
    });
  } else {
    blocks.push({
      type: 'actions',
      block_id: 'control_actions',
      elements: [
        {
          type: 'button',
          action_id: ACTION_CONTROL_CONFIRM,
          style: 'primary',
          text: { type: 'plain_text', text: 'Confirm accuracy' },
          value: encodeSubmission({ submission, updateFlags }),
        },
        {
          type: 'button',
          action_id: ACTION_CONTROL_REJECT,
          style: 'danger',
          text: { type: 'plain_text', text: 'Reject' },
          value: encodeSubmission({ submission, updateFlags }),
        },
      ],
    });
  }

  return blocks;
}

async function openTruckSwitchModal(triggerId) {
  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildTruckSwitchModal(),
  });
}

async function processTruckSwitchSubmission(submission, submitterUserId) {
  const { channelId } = loadConfig().slack;
  const client = slackClient();
  const meta = buildMeta(submitterUserId);
  const text = formatPhase1Message(submission, meta);
  const blocks = buildPhase1Blocks(submission, meta);

  await deliverSlackAndEmail(
    async () => {
      const post = await client.chat.postMessage({
        channel: channelId,
        text,
        blocks,
      });
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
    { phase: 1 }
  );
}

async function handleMarkCompleteAction(payload) {
  const userId = payload.user?.id;
  if (!isSafetyOperator(userId)) {
    return {
      response_type: 'ephemeral',
      text: 'Only safety team members can mark work completed.',
    };
  }

  const action = payload.actions?.[0];
  if (!action?.value) {
    return { response_type: 'ephemeral', text: 'Invalid button payload.' };
  }

  let submission;
  try {
    submission = decodeSubmission(action.value);
  } catch {
    return { response_type: 'ephemeral', text: 'Could not read switch data.' };
  }

  const channel = payload.channel?.id;
  const threadTs = payload.message?.ts;
  if (!channel || !threadTs) {
    return { response_type: 'ephemeral', text: 'Missing message context.' };
  }

  const privateMetadata = JSON.stringify({
    channel,
    thread_ts: threadTs,
    submission,
  });

  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: payload.trigger_id,
    view: buildCompleteModal(privateMetadata),
  });

  return null;
}

async function processCompleteSubmission(view, userId) {
  let ctx;
  try {
    ctx = JSON.parse(view.private_metadata || '{}');
  } catch {
    throw new DeliveryError('Invalid session metadata.');
  }

  const { channel, thread_ts: threadTs, submission } = ctx;
  if (!channel || !threadTs || !submission) {
    throw new DeliveryError('Missing thread or submission data.');
  }

  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);
  const meta = buildMeta(userId);

  const { parseCompleteValues } = require('../blocks/completeModal');
  const { data: updateFlags, errors } = parseCompleteValues(
    view.state.values
  );
  if (Object.keys(errors).length) {
    const err = new Error('Validation failed.');
    err.validationErrors = errors;
    throw err;
  }

  const text = formatPhase2ThreadMessage(submission, updateFlags, meta);
  const blocks = buildPhase2Blocks(submission, updateFlags, meta);

  const parentBlocksBefore = buildPhase1Blocks(submission, meta);
  const parentTextBefore = formatPhase1Message(submission, meta);

  await deliverSlackAndEmail(
    async () => {
      const threadPost = await client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text,
        blocks,
      });

      await client.chat.update({
        channel,
        ts: threadTs,
        text: `${parentTextBefore}\n\n_Work completed — see thread._`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${parentTextBefore}\n\n_Work completed — see thread._`,
            },
          },
        ],
      });

      return {
        rollback: async () => {
          await client.chat.delete({
            channel: threadPost.channel,
            ts: threadPost.ts,
          });
          await client.chat.update({
            channel,
            ts: threadTs,
            text: parentTextBefore,
            blocks: parentBlocksBefore,
          });
        },
      };
    },
    submission,
    meta,
    { phase: 2, updateFlags }
  );
}

async function handleControlConfirmAction(payload) {
  const userId = payload.user?.id;
  if (!isControlOperator(userId)) {
    return {
      response_type: 'ephemeral',
      text: 'Only control team members can verify.',
    };
  }

  const action = payload.actions?.[0];
  const channel = payload.channel?.id;
  const messageTs = payload.message?.ts;
  const threadTs = payload.message?.thread_ts || messageTs;

  let parsed;
  try {
    parsed = decodeSubmission(action.value);
  } catch {
    return { response_type: 'ephemeral', text: 'Invalid button payload.' };
  }

  const { submission, updateFlags } = parsed;
  const meta = buildMeta(userId);
  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);

  const blocks = buildPhase2Blocks(submission, updateFlags, meta, {
    verified: userId,
  });
  const text = formatPhase2ThreadMessage(submission, updateFlags, meta);

  await client.chat.update({
    channel,
    ts: messageTs,
    text,
    blocks,
  });

  await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `Verified by <@${userId}>.`,
  });

  return null;
}

async function handleControlRejectAction(payload) {
  const userId = payload.user?.id;
  if (!isControlOperator(userId)) {
    return {
      response_type: 'ephemeral',
      text: 'Only control team members can reject.',
    };
  }

  const action = payload.actions?.[0];
  const channel = payload.channel?.id;
  const messageTs = payload.message?.ts;
  const threadTs = payload.message?.thread_ts || messageTs;

  const privateMetadata = JSON.stringify({
    channel,
    message_ts: messageTs,
    thread_ts: threadTs,
    button_value: action.value,
  });

  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: payload.trigger_id,
    view: buildRejectModal(privateMetadata),
  });

  return null;
}

async function processRejectSubmission(view, userId) {
  let ctx;
  try {
    ctx = JSON.parse(view.private_metadata || '{}');
  } catch {
    throw new Error('Invalid session metadata.');
  }

  const { parseRejectValues } = require('../blocks/rejectModal');
  const { data, errors } = parseRejectValues(view.state.values);
  if (Object.keys(errors).length) {
    const err = new Error('Validation failed.');
    err.validationErrors = errors;
    throw err;
  }

  let parsed;
  try {
    parsed = decodeSubmission(ctx.button_value);
  } catch {
    throw new Error('Invalid switch data.');
  }

  const { submission, updateFlags } = parsed;
  const meta = buildMeta(userId);
  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);

  const blocks = buildPhase2Blocks(submission, updateFlags, meta, {
    rejectedBy: userId,
    rejectReason: data.reason,
  });
  const text = formatPhase2ThreadMessage(submission, updateFlags, meta);

  await client.chat.update({
    channel: ctx.channel,
    ts: ctx.message_ts,
    text,
    blocks,
  });

  await client.chat.postMessage({
    channel: ctx.channel,
    thread_ts: ctx.thread_ts,
    text: `Rejected by <@${userId}>: ${data.reason}`,
  });
}

module.exports = {
  DeliveryError,
  isUserAllowed,
  openTruckSwitchModal,
  processTruckSwitchSubmission,
  handleMarkCompleteAction,
  processCompleteSubmission,
  handleControlConfirmAction,
  handleControlRejectAction,
  processRejectSubmission,
};
