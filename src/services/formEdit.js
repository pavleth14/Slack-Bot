const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { slackClient } = require('./delivery');
const {
  FORM_EDIT_ACTIONS,
  FORM_BY_EDIT_ACTION,
  ACTION_EDIT_TRUCK_SWITCH,
  ACTION_EDIT_ACCIDENT,
  ACTION_EDIT_LOADS,
  ACTION_EDIT_TRAILER_SWITCH,
} = require('../constants/formEditActions');
const { parsePostMetadata } = require('./interactivePost');
const { parseSimpleFormMetadata } = require('../util/simpleFormMetadata');
const {
  buildEditPrivateMetadata,
  parseEditPrivateMetadata,
} = require('../util/formEditContext');
const { buildTruckSwitchModal } = require('../blocks/truckSwitchModal');
const { buildRoadAccidentModal } = require('../blocks/roadAccidentModal');
const { buildLoadsModal } = require('../blocks/loadsModal');
const { buildTrailerSwitchModal } = require('../blocks/trailerSwitchModal');
const { buildDotModal } = require('../blocks/dotModal');
const { loadDotRecordFromMessage } = require('./dot');

async function postEditEphemeral(client, payload, text) {
  const channel = payload.channel?.id;
  const user = payload.user?.id;
  if (!channel || !user) return;
  try {
    await client.chat.postEphemeral({ channel, user, text });
  } catch (err) {
    console.error('[formEdit] postEphemeral failed:', err.message);
  }
}

function getSubmitterFromMessage(message, actionId) {
  const formHint = FORM_BY_EDIT_ACTION[actionId];

  const truckState = parsePostMetadata(message);
  if (truckState?.submissionMeta?.submitterUserId) {
    return {
      form: 'truck_switch',
      submission: truckState.submission,
      submissionMeta: truckState.submissionMeta,
      fullState: truckState,
    };
  }

  if (formHint === 'dot') {
    const record = loadDotRecordFromMessage(message);
    if (!record) return null;
    return {
      form: 'dot',
      submission: record.submission,
      submissionMeta: record.meta,
      dotId: record.dotId,
    };
  }

  const simple = parseSimpleFormMetadata(message);
  if (!simple) return null;

  const form = FORM_BY_EDIT_ACTION[actionId];
  if (form === 'loads' && simple.eventType !== 'loads_form_v1') return null;
  if (form === 'accident' && simple.eventType !== 'accident_form_v1') {
    return null;
  }
  if (form === 'trailer_switch' && simple.eventType !== 'trailer_switch_form_v1') {
    return null;
  }

  return {
    form,
    submission: simple.submission,
    submissionMeta: simple.submissionMeta,
  };
}

async function handleFormEditButton(payload) {
  const actionId = payload.actions?.[0]?.action_id;
  if (!FORM_EDIT_ACTIONS.has(actionId)) return;

  const userId = payload.user?.id;
  const triggerId = payload.trigger_id;
  const channel = payload.channel?.id;
  const messageTs = payload.message?.ts;
  const message = payload.message;

  if (!triggerId || !channel || !messageTs) {
    return;
  }

  const parsed = getSubmitterFromMessage(message, actionId);
  if (!parsed) {
    await postEditEphemeral(
      slackClient(),
      payload,
      'Could not read this post for editing (missing saved form data).'
    );
    return;
  }

  if (parsed.submissionMeta.submitterUserId !== userId) {
    await postEditEphemeral(
      slackClient(),
      payload,
      'Only the person who submitted this form can edit it.'
    );
    return;
  }

  const form = FORM_BY_EDIT_ACTION[actionId];
  let privateMetadata;
  try {
    privateMetadata = buildEditPrivateMetadata({
      form,
      channel,
      messageTs,
      submitterUserId: userId,
      submissionMeta: parsed.submissionMeta,
      preserve: {
        attachmentNames: parsed.submission.attachmentNames || [],
        dotId: parsed.dotId,
      },
      truckState: parsed.fullState,
    });
  } catch (err) {
    await postEditEphemeral(
      slackClient(),
      payload,
      err.message || 'Could not open the edit form.'
    );
    return;
  }

  const { enableModalFileUpload } = loadConfig().slack;
  let view;

  if (form === 'truck_switch') {
    view = buildTruckSwitchModal({
      includeAttachments: false,
      isEdit: true,
      initial: parsed.submission,
      privateMetadata,
    });
  } else if (form === 'accident') {
    view = buildRoadAccidentModal({
      includeAttachments: false,
      isEdit: true,
      initial: parsed.submission,
      privateMetadata,
    });
  } else if (form === 'loads') {
    view = buildLoadsModal({
      isEdit: true,
      initial: parsed.submission,
      privateMetadata,
    });
  } else if (form === 'trailer_switch') {
    view = buildTrailerSwitchModal({
      includeAttachments: false,
      isEdit: true,
      initial: parsed.submission,
      privateMetadata,
    });
  } else if (form === 'dot') {
    view = buildDotModal({
      includeAttachments: false,
      isEdit: true,
      initial: parsed.submission,
      privateMetadata,
    });
  } else {
    return;
  }

  const client = new WebClient(loadConfig().slack.botToken);
  try {
    await client.views.open({ trigger_id: triggerId, view });
  } catch (err) {
    console.error('[formEdit] views.open failed:', err.message, err.data || '');
    await postEditEphemeral(
      client,
      payload,
      'Could not open the edit form. Try again.'
    );
  }
}

function assertEditSubmitter(editCtx, userId) {
  if (!editCtx || editCtx.submitterUserId !== userId) {
    return 'Only the person who submitted this form can edit it.';
  }
  return null;
}

module.exports = {
  FORM_EDIT_ACTIONS,
  ACTION_EDIT_TRUCK_SWITCH,
  ACTION_EDIT_ACCIDENT,
  ACTION_EDIT_LOADS,
  ACTION_EDIT_TRAILER_SWITCH,
  handleFormEditButton,
  parseEditPrivateMetadata,
  assertEditSubmitter,
};
