const CALLBACK_ID = 'loads_submit';

const BLOCK_IDS = {
  loadDate: 'loads_date_block',
  appointmentType: 'loads_appt_type_block',
  appointmentTime: 'loads_appt_time_block',
  appointmentTimeEnd: 'loads_appt_time_end_block',
  confirmationNumber: 'loads_confirmation_block',
  truck: 'loads_truck_block',
  driverName: 'loads_driver_block',
  notes: 'loads_notes_block',
};

const APPOINTMENT_TYPE_OPTIONS = [
  {
    value: 'fixed',
    text: { type: 'plain_text', text: 'Fixed time' },
  },
  {
    value: 'range',
    text: { type: 'plain_text', text: 'Time range' },
  },
];

const {
  withInitialValue,
  withInitialDate,
  withInitialTime,
  withInitialRadio,
} = require('../util/modalInitialValues');

function buildLoadsModal(options = {}) {
  const initial = options.initial || {};
  const isEdit = Boolean(options.isEdit);
  const appointmentType = initial.appointmentType || 'fixed';

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
        block_id: BLOCK_IDS.appointmentType,
        label: { type: 'plain_text', text: 'Appointment time' },
        hint: {
          type: 'plain_text',
          text: 'Fixed = exact time. Range = window from–to (pickup / delivery / work).',
        },
        element: withInitialRadio(
          {
            type: 'radio_buttons',
            action_id: 'appointment_type',
            options: APPOINTMENT_TYPE_OPTIONS,
          },
          appointmentType,
          APPOINTMENT_TYPE_OPTIONS
        ),
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.appointmentTime,
        label: {
          type: 'plain_text',
          text: 'Time (fixed) / From (range)',
        },
        element: withInitialTime(
          { type: 'timepicker', action_id: 'appointment_time' },
          initial.appointmentTime
        ),
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.appointmentTimeEnd,
        optional: true,
        label: { type: 'plain_text', text: 'To (range only)' },
        hint: {
          type: 'plain_text',
          text: 'Required when Appointment time is Time range.',
        },
        element: withInitialTime(
          { type: 'timepicker', action_id: 'appointment_time_end' },
          initial.appointmentTimeEnd
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

function formatAppointmentDisplay(appointmentType, start, end) {
  const from = String(start || '').trim();
  if (!from) return '';
  if (appointmentType === 'range') {
    const to = String(end || '').trim();
    if (!to) return from;
    return `${from}-${to}`;
  }
  return from;
}

function parseSubmissionValues(values) {
  const loadDate =
    values[BLOCK_IDS.loadDate]?.load_date?.selected_date || '';
  const appointmentType =
    values[BLOCK_IDS.appointmentType]?.appointment_type?.selected_option
      ?.value || '';
  const appointmentTime =
    values[BLOCK_IDS.appointmentTime]?.appointment_time?.selected_time || '';
  const appointmentTimeEnd =
    values[BLOCK_IDS.appointmentTimeEnd]?.appointment_time_end?.selected_time ||
    '';
  const confirmationNumber =
    values[BLOCK_IDS.confirmationNumber]?.confirmation_number?.value?.trim() ||
    '';
  const truck = values[BLOCK_IDS.truck]?.truck?.value?.trim() || '';
  const driverName =
    values[BLOCK_IDS.driverName]?.driver_name?.value?.trim() || '';
  const notes = values[BLOCK_IDS.notes]?.notes?.value?.trim() || '';

  const errors = {};
  if (!loadDate) errors[BLOCK_IDS.loadDate] = 'Date is required.';
  if (!appointmentType) {
    errors[BLOCK_IDS.appointmentType] = 'Select fixed time or time range.';
  }
  if (!appointmentTime) {
    errors[BLOCK_IDS.appointmentTime] =
      appointmentType === 'range'
        ? 'Range start time is required.'
        : 'Appointment time is required.';
  }
  if (appointmentType === 'range') {
    if (!appointmentTimeEnd) {
      errors[BLOCK_IDS.appointmentTimeEnd] = 'Range end time is required.';
    } else if (
      appointmentTime &&
      appointmentTimeEnd &&
      appointmentTimeEnd <= appointmentTime
    ) {
      errors[BLOCK_IDS.appointmentTimeEnd] =
        'End time must be after start time.';
    }
  }
  if (!confirmationNumber) {
    errors[BLOCK_IDS.confirmationNumber] = 'Confirmation number is required.';
  }
  if (!truck) errors[BLOCK_IDS.truck] = 'Truck is required.';
  if (!driverName) errors[BLOCK_IDS.driverName] = 'Driver name is required.';

  const appointmentDisplay = formatAppointmentDisplay(
    appointmentType,
    appointmentTime,
    appointmentType === 'range' ? appointmentTimeEnd : ''
  );

  return {
    data: {
      loadDate,
      loadDateDisplay: formatLoadDateForPost(loadDate),
      appointmentType,
      appointmentTime,
      appointmentTimeEnd:
        appointmentType === 'range' ? appointmentTimeEnd : '',
      appointmentDisplay,
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
  formatAppointmentDisplay,
};
