const CALLBACK_ID = 'return_equipment_submit';

const BLOCK_IDS = {
  damages: 'return_equipment_damages_block',
  mattress: 'return_equipment_mattress_block',
  truckDetailing: 'return_equipment_truck_detailing_block',
};

const { withInitialValue } = require('../util/modalInitialValues');

function textBlock(blockId, label, actionId, initial) {
  return {
    type: 'input',
    block_id: blockId,
    optional: true,
    label: { type: 'plain_text', text: label },
    element: withInitialValue(
      {
        type: 'plain_text_input',
        action_id: actionId,
        multiline: true,
      },
      initial
    ),
  };
}

function buildReturnEquipmentModal(options = {}) {
  const initial = options.initial || {};
  const isEdit = Boolean(options.isEdit);

  const view = {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: {
      type: 'plain_text',
      text: isEdit ? 'Edit return equipment' : 'Return equipment',
    },
    submit: { type: 'plain_text', text: isEdit ? 'Save' : 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      textBlock(
        BLOCK_IDS.damages,
        'Damages',
        'damages',
        initial.damages
      ),
      textBlock(
        BLOCK_IDS.mattress,
        'Mattress',
        'mattress',
        initial.mattress
      ),
      textBlock(
        BLOCK_IDS.truckDetailing,
        'Truck Detailing',
        'truck_detailing',
        initial.truckDetailing
      ),
    ],
  };

  if (options.privateMetadata) {
    view.private_metadata = options.privateMetadata;
  }

  return view;
}

function parseSubmissionValues(values) {
  const damages =
    values[BLOCK_IDS.damages]?.damages?.value?.trim() || '';
  const mattress =
    values[BLOCK_IDS.mattress]?.mattress?.value?.trim() || '';
  const truckDetailing =
    values[BLOCK_IDS.truckDetailing]?.truck_detailing?.value?.trim() || '';

  const errors = {};
  if (!damages && !mattress && !truckDetailing) {
    errors[BLOCK_IDS.damages] =
      'Enter at least one of Damages, Mattress, or Truck Detailing.';
  }

  return {
    data: { damages, mattress, truckDetailing },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildReturnEquipmentModal,
  parseSubmissionValues,
};
