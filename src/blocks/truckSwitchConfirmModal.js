const CONFIRM_CALLBACK_ID = 'truck_switch_confirm_v1';
const CONFIRM_BLOCK_ID = 'truck_switch_confirm_block';

const SYSTEM_LABELS = {
  fuel: 'Fuel Card',
  samsara: 'Samsara',
  tms: 'TMS',
};

function buildPrivateMetadata({ channel, messageTs, systemKey, intent, actorUserId }) {
  return JSON.stringify({
    channel,
    messageTs,
    systemKey,
    intent,
    actorUserId,
  });
}

function parsePrivateMetadata(raw) {
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw);
    if (!data.channel || !data.messageTs || !data.systemKey || !data.intent) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function buildConfirmModal({ channel, messageTs, systemKey, intent, actorUserId }) {
  const label = SYSTEM_LABELS[systemKey] || systemKey;
  let body;
  if (intent === 'revert') {
    body = `Revert *${label}* to pending?`;
  } else {
    body = `Mark *${label}* as UPDATED?`;
  }

  return {
    type: 'modal',
    callback_id: CONFIRM_CALLBACK_ID,
    private_metadata: buildPrivateMetadata({
      channel,
      messageTs,
      systemKey,
      intent,
      actorUserId,
    }),
    title: { type: 'plain_text', text: 'Are you sure?' },
    submit: { type: 'plain_text', text: 'Yes' },
    close: { type: 'plain_text', text: 'No' },
    blocks: [
      {
        type: 'section',
        block_id: CONFIRM_BLOCK_ID,
        text: { type: 'mrkdwn', text: body },
      },
    ],
  };
}

module.exports = {
  CONFIRM_CALLBACK_ID,
  CONFIRM_BLOCK_ID,
  SYSTEM_LABELS,
  buildConfirmModal,
  parsePrivateMetadata,
};
