const CALLBACK_ID = 'unitswitch_reject_submit';
const BLOCK_IDS = {
  reason: 'reject_reason_block',
};

function buildRejectModal(privateMetadata) {
  return {
    type: 'modal',
    callback_id: CALLBACK_ID,
    private_metadata: privateMetadata,
    title: { type: 'plain_text', text: 'Reject verification' },
    submit: { type: 'plain_text', text: 'Submit rejection' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: BLOCK_IDS.reason,
        label: { type: 'plain_text', text: 'Reason' },
        element: {
          type: 'plain_text_input',
          action_id: 'reason',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'What is incorrect or missing?',
          },
        },
      },
    ],
  };
}

function parseRejectValues(values) {
  const reason =
    values[BLOCK_IDS.reason]?.reason?.value?.trim() || '';
  const errors = {};
  if (!reason) {
    errors[BLOCK_IDS.reason] = 'Please provide a reason for rejection.';
  }
  return { data: { reason }, errors };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildRejectModal,
  parseRejectValues,
};
