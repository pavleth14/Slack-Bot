const CALLBACK_ID = 'truck_switch_submit';
const BLOCK_IDS = {
  driver: 'driver_block',
  oldTruck: 'old_truck_block',
  newTruck: 'new_truck_block',
  switchTemporary: 'switch_temporary_block',
  oldTrailer: 'old_trailer_block',
  newTrailer: 'new_trailer_block',
  requiredUpdates: 'required_updates_block',
  locationNote: 'location_note_block',
  attachments: 'attachments_block',
};

const ATTACHMENT_ACTION_ID = 'attachments';
const MAX_ATTACHMENT_FILES = 5;

function buildAttachmentBlock() {
  return {
    type: 'input',
    block_id: BLOCK_IDS.attachments,
    optional: true,
    label: { type: 'plain_text', text: 'Attachments (optional)' },
    hint: {
      type: 'plain_text',
      text: 'PDF or images, up to 5 files.',
    },
    element: {
      type: 'file_input',
      action_id: ATTACHMENT_ACTION_ID,
      max_files: MAX_ATTACHMENT_FILES,
    },
  };
}

function buildTruckSwitchModal(options = {}) {
  const includeAttachments = options.includeAttachments !== false;

  const blocks = [
      {
        type: 'input',
        block_id: BLOCK_IDS.driver,
        label: { type: 'plain_text', text: 'Driver name' },
        element: {
          type: 'plain_text_input',
          action_id: 'driver',
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.oldTruck,
        label: { type: 'plain_text', text: 'Old Truck Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'old_truck',
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.newTruck,
        label: { type: 'plain_text', text: 'New Truck Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'new_truck',
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.switchTemporary,
        label: { type: 'plain_text', text: 'Switch is temporary?' },
        element: {
          type: 'radio_buttons',
          action_id: 'switch_temporary',
          options: [
            {
              value: 'yes',
              text: { type: 'plain_text', text: 'Yes — temporary' },
            },
            {
              value: 'no',
              text: { type: 'plain_text', text: 'No' },
            },
          ],
          initial_option: {
            value: 'yes',
            text: { type: 'plain_text', text: 'Yes — temporary' },
          },
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.oldTrailer,
        optional: true,
        label: { type: 'plain_text', text: 'Old Trailer Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'old_trailer',
          placeholder: { type: 'plain_text', text: '/ if none' },
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.newTrailer,
        optional: true,
        label: { type: 'plain_text', text: 'New Trailer Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'new_trailer',
          placeholder: { type: 'plain_text', text: '/ if none' },
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.requiredUpdates,
        label: { type: 'plain_text', text: 'Required Updates' },
        element: {
          type: 'plain_text_input',
          action_id: 'required_updates',
          initial_value: 'Truck switch.',
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.locationNote,
        optional: true,
        label: { type: 'plain_text', text: 'Location Note' },
        element: {
          type: 'plain_text_input',
          action_id: 'location_note',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'e.g. truck left at shop, city',
          },
        },
      },
  ];

  if (includeAttachments) {
    blocks.push(buildAttachmentBlock());
  }

  return {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: { type: 'plain_text', text: 'TRUCK SWITCH' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
}

function parseSubmissionValues(values) {
  const driver =
    values[BLOCK_IDS.driver]?.driver?.value?.trim() || '';
  const oldTruck =
    values[BLOCK_IDS.oldTruck]?.old_truck?.value?.trim() || '';
  const newTruck =
    values[BLOCK_IDS.newTruck]?.new_truck?.value?.trim() || '';
  const tempSelected =
    values[BLOCK_IDS.switchTemporary]?.switch_temporary?.selected_option
      ?.value || 'yes';
  const oldTrailer =
    values[BLOCK_IDS.oldTrailer]?.old_trailer?.value?.trim() || '';
  const newTrailer =
    values[BLOCK_IDS.newTrailer]?.new_trailer?.value?.trim() || '';
  const requiredUpdates =
    values[BLOCK_IDS.requiredUpdates]?.required_updates?.value?.trim() ||
    'Truck switch.';
  const locationNote =
    values[BLOCK_IDS.locationNote]?.location_note?.value?.trim() || '';
  const attachmentFiles = (
    values[BLOCK_IDS.attachments]?.[ATTACHMENT_ACTION_ID]?.files || []
  )
    .filter((f) => f?.id)
    .map((f) => ({
      id: f.id,
      name: f.name || f.title || 'attachment',
    }));

  const errors = {};
  if (!driver) errors[BLOCK_IDS.driver] = 'Driver name is required.';
  if (!oldTruck) errors[BLOCK_IDS.oldTruck] = 'Old truck number is required.';
  if (!newTruck) errors[BLOCK_IDS.newTruck] = 'New truck number is required.';
  if (!requiredUpdates) {
    errors[BLOCK_IDS.requiredUpdates] = 'Required updates is required.';
  }

  return {
    data: {
      driver,
      oldTruck,
      newTruck,
      switchTemporary: tempSelected === 'yes',
      oldTrailer,
      newTrailer,
      requiredUpdates,
      locationNote,
      attachmentFiles,
    },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildTruckSwitchModal,
  parseSubmissionValues,
};
