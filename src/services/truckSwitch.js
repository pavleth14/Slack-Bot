const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildTruckSwitchModal } = require('../blocks/truckSwitchModal');
const { buildCompleteModal } = require('../blocks/completeModal');
const {
  formatPhase1Message,
  formatPhase2ThreadMessage,
} = require('../format/truckSwitchMessage');
const { ACTION_MARK_COMPLETE } = require('../constants/actions');
const { deliverSlackAndEmail, DeliveryError, slackClient } = require('./delivery');
const {
  isUserAllowed,
  isSafetyOperator,
} = require('./access');

function buildMeta(submitterUserId, extra = {}) {
  const {
    safetyTeamUsergroupId,
    controlTeamUsergroupId,
    eldTeamUsergroupId,
  } = loadConfig().slack;
  return {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
    safetyTeamUsergroupId,
    controlTeamUsergroupId,
    eldTeamUsergroupId,
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

function buildPhase2Blocks(submission, updateFlags, meta) {
  const text = formatPhase2ThreadMessage(submission, updateFlags, meta);
  return [
    { type: 'section', text: { type: 'mrkdwn', text } },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Teams: reply in thread when your part is done. Control: add :white_check_mark: reaction to verify.',
        },
      ],
    },
  ];
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

  const client = slackClient();
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

module.exports = {
  DeliveryError,
  isUserAllowed,
  isSafetyOperator,
  openTruckSwitchModal,
  processTruckSwitchSubmission,
  handleMarkCompleteAction,
  processCompleteSubmission,
};
