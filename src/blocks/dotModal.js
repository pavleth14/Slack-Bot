const { DOT_GROUPS } = require('./dotFields');
const {
  withInitialValue,
  withInitialDate,
  withInitialTime,
  withInitialCheckboxes,
} = require('../util/modalInitialValues');
const { selectionList } = require('../services/dotSelection');

const CALLBACK_ID = 'dot_inspection_submit';

const BLOCK_IDS = {
  driverName: 'dot_driver_block',
  truckNumber: 'dot_truck_block',
  trailerNumber: 'dot_trailer_block',
  inspectionDate: 'dot_date_block',
  inspectionTime: 'dot_time_block',
  locationState: 'dot_location_block',
  violationDescription: 'dot_violation_desc_block',
  inspectionReport: 'dot_report_files_block',
  additionalNotes: 'dot_notes_block',
};

const REPORT_FILE_ACTION_ID = 'inspection_report_files';
const MAX_REPORT_FILES = 5;

function checkboxOptions(group) {
  return group.options.map((o) => ({
    value: o.value,
    text: { type: 'plain_text', text: o.text },
  }));
}

function buildGroupCheckboxBlock(group, initialSubmission) {
  const selected = selectionList(initialSubmission[group.key]);
  return {
    type: 'input',
    block_id: `dot_modal_${group.key}`,
    optional: group.key === 'violationSubjects',
    label: { type: 'plain_text', text: group.label },
    element: withInitialCheckboxes(
      {
        type: 'checkboxes',
        action_id: group.key,
        options: checkboxOptions(group),
      },
      selected,
      checkboxOptions(group)
    ),
  };
}

function parseGroupCheckbox(values, group) {
  const blockId = `dot_modal_${group.key}`;
  const selected =
    values[blockId]?.[group.key]?.selected_options?.map((o) => o.value) || [];
  if (group.postMode === 'exclusive') {
    return selected.length ? [selected[selected.length - 1]] : [];
  }
  return selected;
}

function buildDotModal(options = {}) {
  const initial = options.initial || {};
  const isEdit = Boolean(options.isEdit);
  const includeAttachments = options.includeAttachments !== false;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'DOT Roadside Inspection Report' },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*1. Driver Information*' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.driverName,
      label: { type: 'plain_text', text: 'Driver Name' },
      element: withInitialValue(
        { type: 'plain_text_input', action_id: 'driver_name' },
        initial.driverName
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.truckNumber,
      label: { type: 'plain_text', text: 'Truck Number' },
      element: withInitialValue(
        { type: 'plain_text_input', action_id: 'truck_number' },
        initial.truckNumber
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.trailerNumber,
      optional: true,
      label: { type: 'plain_text', text: 'Trailer Number' },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'trailer_number',
          placeholder: { type: 'plain_text', text: '/ if none' },
        },
        initial.trailerNumber
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.inspectionDate,
      label: { type: 'plain_text', text: 'Date' },
      element: withInitialDate(
        { type: 'datepicker', action_id: 'inspection_date' },
        initial.inspectionDate
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.inspectionTime,
      label: { type: 'plain_text', text: 'Time' },
      element: withInitialTime(
        { type: 'timepicker', action_id: 'inspection_time' },
        initial.inspectionTime
      ),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.locationState,
      label: { type: 'plain_text', text: 'Location / State' },
      element: withInitialValue(
        { type: 'plain_text_input', action_id: 'location_state' },
        initial.locationState
      ),
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*2. Inspection Details*' },
    },
    buildGroupCheckboxBlock(DOT_GROUPS[0], initial),
    buildGroupCheckboxBlock(DOT_GROUPS[1], initial),
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*3. Violations (if any)*' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.violationDescription,
      optional: true,
      label: { type: 'plain_text', text: 'Description of Violation' },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'violation_description',
          multiline: true,
        },
        initial.violationDescription
      ),
    },
    buildGroupCheckboxBlock(DOT_GROUPS[2], initial),
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*4. Supporting Documents*' },
    },
  ];

  if (includeAttachments) {
    blocks.push({
      type: 'input',
      block_id: BLOCK_IDS.inspectionReport,
      optional: true,
      label: { type: 'plain_text', text: 'Inspection Report (photo/PDF)' },
      element: {
        type: 'file_input',
        action_id: REPORT_FILE_ACTION_ID,
        max_files: MAX_REPORT_FILES,
      },
    });
  }

  blocks.push(
    buildGroupCheckboxBlock(DOT_GROUPS[3], initial),
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*5. Current Status*' },
    },
    buildGroupCheckboxBlock(DOT_GROUPS[4], initial),
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*6. Driver Confirmation*' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.additionalNotes,
      optional: true,
      label: { type: 'plain_text', text: 'Additional Notes' },
      element: withInitialValue(
        {
          type: 'plain_text_input',
          action_id: 'additional_notes',
          multiline: true,
        },
        initial.additionalNotes
      ),
    }
  );

  const view = {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: { type: 'plain_text', text: isEdit ? 'Edit DOT report' : 'DOT Inspection' },
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
  const driverName =
    values[BLOCK_IDS.driverName]?.driver_name?.value?.trim() || '';
  const truckNumber =
    values[BLOCK_IDS.truckNumber]?.truck_number?.value?.trim() || '';
  const trailerNumber =
    values[BLOCK_IDS.trailerNumber]?.trailer_number?.value?.trim() || '';
  const inspectionDate =
    values[BLOCK_IDS.inspectionDate]?.inspection_date?.selected_date || '';
  const inspectionTime =
    values[BLOCK_IDS.inspectionTime]?.inspection_time?.selected_time || '';
  const locationState =
    values[BLOCK_IDS.locationState]?.location_state?.value?.trim() || '';
  const violationDescription =
    values[BLOCK_IDS.violationDescription]?.violation_description?.value?.trim() ||
    '';
  const additionalNotes =
    values[BLOCK_IDS.additionalNotes]?.additional_notes?.value?.trim() || '';
  const attachmentFiles = (
    values[BLOCK_IDS.inspectionReport]?.[REPORT_FILE_ACTION_ID]?.files || []
  )
    .filter((f) => f?.id)
    .map((f) => ({
      id: f.id,
      name: f.name || f.title || 'attachment',
    }));

  const groupValues = {};
  for (const group of DOT_GROUPS) {
    groupValues[group.key] = parseGroupCheckbox(values, group);
  }

  const errors = {};
  if (!driverName) errors[BLOCK_IDS.driverName] = 'Driver name is required.';
  if (!truckNumber) errors[BLOCK_IDS.truckNumber] = 'Truck number is required.';
  if (!inspectionDate) {
    errors[BLOCK_IDS.inspectionDate] = 'Date is required.';
  }
  if (!inspectionTime) {
    errors[BLOCK_IDS.inspectionTime] = 'Time is required.';
  }
  if (!locationState) {
    errors[BLOCK_IDS.locationState] = 'Location / State is required.';
  }

  return {
    data: {
      driverName,
      truckNumber,
      trailerNumber,
      inspectionDate,
      inspectionTime,
      locationState,
      violationDescription,
      additionalNotes,
      attachmentFiles,
      ...groupValues,
    },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildDotModal,
  parseSubmissionValues,
};
