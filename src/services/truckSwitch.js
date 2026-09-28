const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildTruckSwitchModal } = require('../blocks/truckSwitchModal');
const { deliverSlackAndEmail, DeliveryError, slackClient } = require('./delivery');
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
  ACTION_TO_SYSTEM,
} = require('../constants/actions');

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
    { phase: 1 }
  );

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

async function handleSystemCheckboxAction(payload) {
  const action = payload.actions?.[0];
  const actionId = action?.action_id;

  if (!CHECK_ACTIONS.has(actionId)) {
    return null;
  }

  const selected = action.selected_options || [];
  if (!selected.length) {
    return { response_type: 'ephemeral', text: 'Select the checkbox to mark updated.' };
  }

  const userId = payload.user?.id;
  const channel = payload.channel?.id;
  const messageTs = payload.message?.ts;

  const state = parsePostMetadata(payload.message);
  if (!state) {
    return { response_type: 'ephemeral', text: 'Could not read switch state.' };
  }

  const systemKey = ACTION_TO_SYSTEM[actionId];
  if (state.checks[systemKey]) {
    return {
      response_type: 'ephemeral',
      text: 'This system is already marked UPDATED.',
    };
  }

  state.checks[systemKey] = userId;
  const submission = state.submission;
  const meta = buildMeta(
    state.submissionMeta?.submitterUserId || userId,
    {
      submittedAtIso:
        state.submissionMeta?.submittedAtIso || new Date().toISOString(),
    }
  );

  const client = slackClient();
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

  if (allSystemsUpdated(state.checks) && !state.workCompleteMailSent) {
    if (state.emailMessageId && state.emailSubject) {
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
        } else {
          state.workCompleteMailSent = true;
          await client.chat.update({
            channel,
            ts: messageTs,
            text: buildPostFallbackText(submission, meta, state),
            blocks: buildInteractiveBlocks(submission, meta, state),
            metadata: { event_type: 'truck_switch_v1', event_payload: state },
          });
        }
      } catch (err) {
        console.error('[truckSwitch] work-complete reply email failed:', err.message);
      }
    }
  }

  return null;
}

module.exports = {
  DeliveryError,
  isUserAllowed,
  openTruckSwitchModal,
  processTruckSwitchSubmission,
  handleSystemCheckboxAction,
};
