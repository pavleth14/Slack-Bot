const CALLBACK_ID = 'trailer_switch_submit';

const BLOCK_IDS = {
  action: 'trailer_switch_action_block',
  truck: 'trailer_switch_truck_block',
  driverName: 'trailer_switch_driver_block',
  trailerNumber: 'trailer_switch_trailer_block',
  trailerStatus: 'trailer_switch_status_block',
  loadNumber: 'trailer_switch_load_block',
  location: 'trailer_switch_location_block',
  notes: 'trailer_switch_notes_block',
  attachments: 'trailer_switch_attachments_block',
};

const ATTACHMENT_ACTION_ID = 'attachments';
const MAX_ATTACHMENT_FILES = 5;

const {
  withInitialValue,
  withInitialStaticSelect,
} = require('../util/modalInitialValues');

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

const ACTION_OPTIONS = [
  { text: { type: 'plain_text', text: 'Pick up' }, value: 'pickup' },
  { text: { type: 'plain_text', text: 'Drop off' }, value: 'dropoff' },
];

const STATUS_OPTIONS = [
  { text: { type: 'plain_text', text: 'Empty' }, value: 'empty' },
  { text: { type: 'plain_text', text: 'Loaded' }, value: 'loaded' },
];

function buildTrailerSwitchModal(options = {}) {
  const includeAttachments = options.includeAttachments !== false;
  const initial = options.initial || {};
  const isEdit = Boolean(options.isEdit);

  const blocks = [
    {
      type: 'input',
      block_id: BLOCK_IDS.action,
      label: { type: 'plain_text', text: 'Action' },
      element: withInitialStaticSelect(
        {
          type: 'static_select',
          action_id: 'action',
          placeholder: { type: 'plain_text', text: 'Pick up or drop off' },
          options: ACTION_OPTIONS,
        },
        initial.action,
        ACTION_OPTIONS
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.truck,
      label: { type: 'plain_text', text: 'Truck number' },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'truck',
          placeholder: { type: 'plain_text', text: '223' },
        },
        initial.truck
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.driverName,
      label: { type: 'plain_text', text: 'Driver name' },
      element: withInitialValue(
        { type: 'plain_text_input', action_id: 'driver_name' },
        initial.driverName
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.trailerNumber,
      label: { type: 'plain_text', text: 'Trailer number' },
      hint: {
        type: 'plain_text',
        text: 'Free text; # is added in the post if you omit it.',
      },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'trailer_number',
          placeholder: { type: 'plain_text', text: '#S532404' },
        },
        initial.trailerNumber
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.trailerStatus,
      label: { type: 'plain_text', text: 'Trailer status' },
      element: withInitialStaticSelect(
        {
          type: 'static_select',
          action_id: 'trailer_status',
          placeholder: { type: 'plain_text', text: 'Empty or loaded' },
          options: STATUS_OPTIONS,
        },
        initial.trailerStatus,
        STATUS_OPTIONS
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.loadNumber,
      optional: true,
      label: { type: 'plain_text', text: 'Load number' },
      hint: {
        type: 'plain_text',
        text: 'Required when trailer is loaded.',
      },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'load_number',
          placeholder: { type: 'plain_text', text: '25372' },
        },
        initial.loadNumber
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.location,
      label: { type: 'plain_text', text: 'Location' },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'location',
          placeholder: {
            type: 'plain_text',
            text: 'Justice Yard IL or full street address',
          },
        },
        initial.location
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.notes,
      optional: true,
      label: { type: 'plain_text', text: 'Notes' },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'notes',
          multiline: true,
        },
        initial.notes
      ),
    },
  ];

  if (includeAttachments && !isEdit) {
    blocks.push(buildAttachmentBlock());
  }

  const view = {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: {
      type: 'plain_text',
      text: isEdit ? 'Edit trailer switch' : 'Trailer switch',
    },
    submit: { type: 'plain_text', text: isEdit ? 'Save' : 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };

  if (options.privateMetadata) {
    view.private_metadata = options.privateMetadata;
  }

  return view;
}

function parseSubmissionValues(values) {
  const action =
    values[BLOCK_IDS.action]?.action?.selected_option?.value || '';
  const truck = values[BLOCK_IDS.truck]?.truck?.value?.trim() || '';
  const driverName =
    values[BLOCK_IDS.driverName]?.driver_name?.value?.trim() || '';
  const trailerNumber =
    values[BLOCK_IDS.trailerNumber]?.trailer_number?.value?.trim() || '';
  const trailerStatus =
    values[BLOCK_IDS.trailerStatus]?.trailer_status?.selected_option?.value ||
    '';
  const loadNumber =
    values[BLOCK_IDS.loadNumber]?.load_number?.value?.trim() || '';
  const location = values[BLOCK_IDS.location]?.location?.value?.trim() || '';
  const notes = values[BLOCK_IDS.notes]?.notes?.value?.trim() || '';
  const attachmentFiles = (
    values[BLOCK_IDS.attachments]?.[ATTACHMENT_ACTION_ID]?.files || []
  )
    .filter((f) => f?.id)
    .map((f) => ({
      id: f.id,
      name: f.name || f.title || 'attachment',
    }));

  const errors = {};
  if (!action) errors[BLOCK_IDS.action] = 'Select pick up or drop off.';
  if (!truck) errors[BLOCK_IDS.truck] = 'Truck number is required.';
  if (!driverName) errors[BLOCK_IDS.driverName] = 'Driver name is required.';
  if (!trailerNumber) {
    errors[BLOCK_IDS.trailerNumber] = 'Trailer number is required.';
  }
  if (!trailerStatus) {
    errors[BLOCK_IDS.trailerStatus] = 'Select empty or loaded.';
  }
  if (trailerStatus === 'loaded' && !loadNumber) {
    errors[BLOCK_IDS.loadNumber] = 'Load number is required when loaded.';
  }
  if (!location) errors[BLOCK_IDS.location] = 'Location is required.';

  return {
    data: {
      action,
      truck,
      driverName,
      trailerNumber,
      trailerStatus,
      loadNumber: trailerStatus === 'loaded' ? loadNumber : '',
      location,
      notes,
      attachmentFiles,
    },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildTrailerSwitchModal,
  parseSubmissionValues,
};
