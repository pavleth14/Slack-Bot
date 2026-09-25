const CALLBACK_ID = 'unitswitch_complete_submit';
const BLOCK_IDS = {
  updates: 'updates_block',
};

const CHECKBOX_OPTIONS = {
  fuel: { value: 'fuel', text: 'Fuel card' },
  samsara: { value: 'samsara', text: 'Samsara' },
  tms: { value: 'tms', text: 'TMS' },
};

function buildCompleteModal(privateMetadata) {
  return {
    type: 'modal',
    callback_id: CALLBACK_ID,
    private_metadata: privateMetadata,
    title: { type: 'plain_text', text: 'Work completed' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Check each system that was *updated* for this unit switch.',
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.updates,
        label: { type: 'plain_text', text: 'Updated systems' },
        element: {
          type: 'checkboxes',
          action_id: 'updates',
          options: Object.values(CHECKBOX_OPTIONS).map((o) => ({
            value: o.value,
            text: { type: 'plain_text', text: o.text },
          })),
        },
      },
    ],
  };
}

function parseCompleteValues(values) {
  const selected =
    values[BLOCK_IDS.updates]?.updates?.selected_options || [];
  const flags = {
    fuel: selected.some((o) => o.value === 'fuel'),
    samsara: selected.some((o) => o.value === 'samsara'),
    tms: selected.some((o) => o.value === 'tms'),
  };

  const errors = {};
  if (!flags.fuel && !flags.samsara && !flags.tms) {
    errors[BLOCK_IDS.updates] = 'Select at least one updated system.';
  }

  return { data: flags, errors };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildCompleteModal,
  parseCompleteValues,
};
