const CALLBACK_ID = 'loads_submit';

const BLOCK_IDS = {
  loadDate: 'loads_date_block',
  confirmationNumber: 'loads_confirmation_block',
  truck: 'loads_truck_block',
  driverName: 'loads_driver_block',
  notes: 'loads_notes_block',
};

const {
  withInitialValue,
  withInitialDate,
} = require('../util/modalInitialValues');

function buildLoadsModal(options = {}) {
  const initial = options.initial || {};
  const isEdit = Boolean(options.isEdit);

  const view = {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: { type: 'plain_text', text: isEdit ? 'Edit load' : 'New load' },
    submit: { type: 'plain_text', text: isEdit ? 'Save' : 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: BLOCK_IDS.loadDate,
        label: { type: 'plain_text', text: 'Date' },
        element: withInitialDate(
          { type: 'datepicker', action_id: 'load_date' },
          initial.loadDate
        ),
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.confirmationNumber,
        label: { type: 'plain_text', text: 'Confirmation number' },
        element: withInitialValue(
          { type: 'plain_text_input', action_id: 'confirmation_number' },
          initial.confirmationNumber
        ),
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.truck,
        label: { type: 'plain_text', text: 'Truck' },
        element: withInitialValue(
          { type: 'plain_text_input', action_id: 'truck' },
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
        block_id: BLOCK_IDS.notes,
        optional: true,
        label: { type: 'plain_text', text: 'Notes' },
        element: withInitialValue(
          {
            type: 'plain_text_input',
            action_id: 'notes',
            multiline: true,
            placeholder: { type: 'plain_text', text: 'Load description…' },
          },
          initial.notes
        ),
      },
    ],
  };

  if (options.privateMetadata) {
    view.private_metadata = options.privateMetadata;
  }

  return view;
}

function formatLoadDateForPost(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return isoDate;
  }
  const [year, month, day] = parts;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${mm}-${dd}-${year}`;
}

function parseSubmissionValues(values) {
  const loadDate =
    values[BLOCK_IDS.loadDate]?.load_date?.selected_date || '';
  const confirmationNumber =
    values[BLOCK_IDS.confirmationNumber]?.confirmation_number?.value?.trim() ||
    '';
  const truck = values[BLOCK_IDS.truck]?.truck?.value?.trim() || '';
  const driverName =
    values[BLOCK_IDS.driverName]?.driver_name?.value?.trim() || '';
  const notes = values[BLOCK_IDS.notes]?.notes?.value?.trim() || '';

  const errors = {};
  if (!loadDate) errors[BLOCK_IDS.loadDate] = 'Date is required.';
  if (!confirmationNumber) {
    errors[BLOCK_IDS.confirmationNumber] = 'Confirmation number is required.';
  }
  if (!truck) errors[BLOCK_IDS.truck] = 'Truck is required.';
  if (!driverName) errors[BLOCK_IDS.driverName] = 'Driver name is required.';

  return {
    data: {
      loadDate,
      loadDateDisplay: formatLoadDateForPost(loadDate),
      confirmationNumber,
      truck,
      driverName,
      notes,
    },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildLoadsModal,
  parseSubmissionValues,
  formatLoadDateForPost,
};
