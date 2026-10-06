const crypto = require('crypto');
const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { isUserAllowed } = require('./access');
const { slackClient } = require('./delivery');
const { saveClaim, loadClaim } = require('./claimsStore');
const { GROUP_BY_KEY } = require('../blocks/claimsFields');
const {
  buildClaimsModal,
  parseClaimsStep,
  claimsStepIndex,
  firstErrorBlockId,
} = require('../blocks/claimsModal');
const {
  buildClaimsBlocks,
  formatClaimsFallback,
  claimIdFromMessage,
} = require('../format/claimsMessage');
const {
  chunkOptions,
  applyGroupSelection,
  parseSelectionActionId,
} = require('./claimsSelection');

const claimQueues = new Map();

function withClaimLock(claimId, work) {
  const previous = claimQueues.get(claimId) || Promise.resolve();
  const run = previous.then(work, work);
  claimQueues.set(
    claimId,
    run.then(
      () => {},
      () => {}
    )
  );
  return run;
}

function seenSelectionFromMessage(message, action) {
  const blocks = message?.blocks || [];
  const block =
    blocks.find((item) => item.block_id && item.block_id === action?.block_id) ||
    blocks.find((item) => item.accessory?.action_id === action?.action_id);
  if (!block?.accessory) return null;
  return (block.accessory.initial_options || [])
    .map((option) => option.value)
    .filter(Boolean);
}

const drafts = new Map();
const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

function pruneDrafts() {
  const cutoff = Date.now() - DRAFT_TTL_MS;
  for (const [id, draft] of drafts) {
    if (draft.createdAt < cutoff) drafts.delete(id);
  }
}

function createDraft() {
  pruneDrafts();
  const draftId = crypto.randomBytes(8).toString('hex');
  drafts.set(draftId, { createdAt: Date.now(), steps: {} });
  return draftId;
}

function makeClaimId() {
  return `c${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

async function openClaimsModal(triggerId) {
  const { botToken } = loadConfig().slack;
  const draftId = createDraft();
  const client = new WebClient(botToken);
  await client.views.open({
    trigger_id: triggerId,
    view: buildClaimsModal(0, draftId),
  });
}

function readDraftId(view) {
  try {
    const parsed = JSON.parse(view?.private_metadata || '{}');
    return parsed.draftId || '';
  } catch {
    return '';
  }
}

function handleClaimsViewSubmission(payload) {
  const stepIndex = claimsStepIndex(payload.view?.callback_id);
  const userId = payload.user?.id;
  if (stepIndex < 0) {
    return { body: { response_action: 'clear' } };
  }
  const errorBlock = firstErrorBlockId(stepIndex);

  if (!isUserAllowed(userId)) {
    return {
      body: {
        response_action: 'errors',
        errors: { [errorBlock]: 'You are not allowed to submit this form.' },
      },
    };
  }

  const draftId = readDraftId(payload.view);
  const draft = drafts.get(draftId);
  if (!draft) {
    return {
      body: {
        response_action: 'errors',
        errors: { [errorBlock]: 'This form expired. Close it and run /claims again.' },
      },
    };
  }

  const { data, errors } = parseClaimsStep(stepIndex, payload.view.state.values);
  if (Object.keys(errors).length > 0) {
    return { body: { response_action: 'errors', errors } };
  }

  draft.steps[stepIndex] = data;

  if (stepIndex < 2) {
    return {
      body: {
        response_action: 'push',
        view: buildClaimsModal(stepIndex + 1, draftId),
      },
    };
  }

  const submission = {
    ...draft.steps[0],
    ...draft.steps[1],
    ...draft.steps[2],
  };
  drafts.delete(draftId);

  return {
    body: { response_action: 'clear' },
    after: () => processClaimsSubmission(submission, userId),
  };
}

async function notifyClaimsSubmissionFailed(userId, err) {
  const client = slackClient();
  const text = err?.message
    ? `Your claim could not be posted. ${err.message}`
    : 'Your claim could not be posted. Nothing was sent to the channel.';
  try {
    await client.chat.postMessage({ channel: userId, text });
  } catch (dmErr) {
    console.error('[claims] failed to DM submitter:', dmErr.message);
  }
}

async function processClaimsSubmission(submission, submitterUserId) {
  const { claimsChannelId } = loadConfig().slack;
  console.log(`[claims] posting to channel ${claimsChannelId}`);
  const client = slackClient();
  const claimId = makeClaimId();
  const meta = {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
  };
  const record = { submission, meta };
  saveClaim(claimId, record);

  const { blocks, overflowBlocks } = buildClaimsBlocks(submission, meta, claimId, 0);
  const text = formatClaimsFallback(submission);
  const metadata = {
    event_type: 'claims_v1',
    event_payload: { claimId },
  };

  let post;
  try {
    post = await client.chat.postMessage({
      channel: claimsChannelId,
      text,
      blocks,
      metadata,
    });
  } catch (err) {
    const code = err?.data?.error || '';
    if (code === 'not_in_channel') {
      throw new Error('Invite the bot to the claims channel, then submit again.');
    }
    if (code === 'channel_not_found') {
      throw new Error('SLACK_CLAIMS_CHANNEL_ID is not a channel this bot can see.');
    }
    throw new Error(code || err.message || 'Could not post to the Slack channel.');
  }

  if (overflowBlocks.length) {
    try {
      await client.chat.postMessage({
        channel: post.channel,
        thread_ts: post.ts,
        text: 'Claim details continued',
        blocks: overflowBlocks,
      });
    } catch (err) {
      console.error('[claims] overflow thread failed:', err.message);
    }
  }
}

async function handleClaimsSelectionAction(payload) {
  const action = payload.actions?.[0];
  const parsed = parseSelectionActionId(action?.action_id);
  if (!parsed) return;

  const claimId = claimIdFromMessage(payload.message);
  if (!claimId || !loadClaim(claimId)) {
    console.error('[claims] selection for unknown claim', claimId || action?.action_id);
    return;
  }

  const group = GROUP_BY_KEY[parsed.key];
  if (!group) return;

  const seenSelected = seenSelectionFromMessage(payload.message, action);
  const clickedSelected = (action.selected_options || []).map((option) => option.value);
  const channel = payload.channel?.id || payload.container?.channel_id;
  const ts = payload.message?.ts || payload.container?.message_ts;
  if (!channel || !ts) return;

  await withClaimLock(claimId, async () => {
    const record = loadClaim(claimId);
    if (!record) return;
    const parts = chunkOptions(group.options);
    const partValues = (parts[parsed.part] || []).map((option) => option.value);
    record.submission[group.key] = applyGroupSelection(
      record.submission[group.key],
      partValues,
      seenSelected,
      clickedSelected
    );
    record.revision = (Number(record.revision) || 0) + 1;
    saveClaim(claimId, record);

    const { blocks } = buildClaimsBlocks(
      record.submission,
      record.meta,
      claimId,
      record.revision
    );
    const client = slackClient();
    await client.chat.update({
      channel,
      ts,
      text: formatClaimsFallback(record.submission),
      blocks,
      metadata: {
        event_type: 'claims_v1',
        event_payload: { claimId },
      },
    });
  });
}

module.exports = {
  isUserAllowed,
  openClaimsModal,
  handleClaimsViewSubmission,
  processClaimsSubmission,
  notifyClaimsSubmissionFailed,
  handleClaimsSelectionAction,
};
