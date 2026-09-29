const CALLBACK_ID = 'road_accident_submit';

const BLOCK_IDS = {
  driver: 'accident_driver_block',
  unit: 'accident_unit_block',
  trailer: 'accident_trailer_block',
  accidentDate: 'accident_date_block',
  accidentTime: 'accident_time_block',
  location: 'accident_location_block',
  incident: 'accident_incident_block',
  injuries: 'accident_injuries_block',
  police: 'accident_police_block',
  citationIssued: 'accident_citation_block',
  truckDrivable: 'accident_truck_drivable_block',
  truckTowingRequired: 'accident_truck_towing_block',
  trailerDrivable: 'accident_trailer_drivable_block',
  trailerTowingRequired: 'accident_trailer_towing_block',
  attachments: 'accident_attachments_block',
};

const ATTACHMENT_ACTION_ID = 'accident_attachments';
const MAX_ATTACHMENT_FILES = 10;

function yesNoRadio(actionId, initialYes = false) {
  const yes = {
    value: 'yes',
    text: { type: 'plain_text', text: 'Yes' },
  };
  const no = {
    value: 'no',
    text: { type: 'plain_text', text: 'No' },
  };
  return {
    type: 'radio_buttons',
    action_id: actionId,
    options: [yes, no],
    initial_option: initialYes ? yes : no,
  };
}

function buildAttachmentBlock() {
  return {
    type: 'input',
    block_id: BLOCK_IDS.attachments,
    optional: true,
    label: { type: 'plain_text', text: 'Photos or PDF (optional)' },
    hint: {
      type: 'plain_text',
      text: 'Images or PDFs, up to 10 files.',
    },
    element: {
      type: 'file_input',
      action_id: ATTACHMENT_ACTION_ID,
      max_files: MAX_ATTACHMENT_FILES,
    },
  };
}

function buildRoadAccidentModal(options = {}) {
  const includeAttachments = options.includeAttachments !== false;

  const blocks = [
    {
      type: 'input',
      block_id: BLOCK_IDS.driver,
      label: { type: 'plain_text', text: 'Driver' },
      element: { type: 'plain_text_input', action_id: 'driver' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.unit,
      label: { type: 'plain_text', text: 'Unit' },
      element: { type: 'plain_text_input', action_id: 'unit' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.trailer,
      optional: true,
      label: { type: 'plain_text', text: 'Trailer' },
      element: {
        type: 'plain_text_input',
        action_id: 'trailer',
        placeholder: { type: 'plain_text', text: '/ if none' },
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.accidentDate,
      label: { type: 'plain_text', text: 'Date of accident' },
      element: { type: 'datepicker', action_id: 'accident_date' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.accidentTime,
      label: { type: 'plain_text', text: 'Time of accident' },
      element: { type: 'timepicker', action_id: 'accident_time' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.location,
      label: { type: 'plain_text', text: 'Location' },
      element: { type: 'plain_text_input', action_id: 'location' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.incident,
      label: { type: 'plain_text', text: 'Incident' },
      element: {
        type: 'plain_text_input',
        action_id: 'incident',
        multiline: true,
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.injuries,
      label: { type: 'plain_text', text: 'Injuries' },
      element: {
        type: 'plain_text_input',
        action_id: 'injuries',
        placeholder: { type: 'plain_text', text: 'e.g. None reported' },
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.police,
      label: { type: 'plain_text', text: 'Police' },
      element: {
        type: 'plain_text_input',
        action_id: 'police',
        placeholder: {
          type: 'plain_text',
          text: 'e.g. Called — Report #123456',
        },
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.citationIssued,
      label: { type: 'plain_text', text: 'Citation issued?' },
      element: yesNoRadio('citation_issued', false),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.truckDrivable,
      label: { type: 'plain_text', text: 'Truck drivable?' },
      element: yesNoRadio('truck_drivable', true),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.truckTowingRequired,
      label: { type: 'plain_text', text: 'Truck towing required?' },
      element: yesNoRadio('truck_towing', false),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.trailerDrivable,
      label: { type: 'plain_text', text: 'Trailer drivable?' },
      element: yesNoRadio('trailer_drivable', true),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.trailerTowingRequired,
      label: { type: 'plain_text', text: 'Trailer towing required?' },
      element: yesNoRadio('trailer_towing', false),
    },
  ];

  if (includeAttachments) {
    blocks.push(buildAttachmentBlock());
  }

  return {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: { type: 'plain_text', text: 'ROAD ACCIDENT' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
}

function readRadio(values, blockId, actionId, defaultNo = true) {
  const selected =
    values[blockId]?.[actionId]?.selected_option?.value ||
    (defaultNo ? 'no' : 'yes');
  return selected === 'yes';
}

function readYesNoLabel(flag) {
  return flag ? 'Yes' : 'No';
}

function parseSubmissionValues(values) {
  const driver = values[BLOCK_IDS.driver]?.driver?.value?.trim() || '';
  const unit = values[BLOCK_IDS.unit]?.unit?.value?.trim() || '';
  const trailer = values[BLOCK_IDS.trailer]?.trailer?.value?.trim() || '';
  const accidentDate =
    values[BLOCK_IDS.accidentDate]?.accident_date?.selected_date || '';
  const accidentTime =
    values[BLOCK_IDS.accidentTime]?.accident_time?.selected_time || '';
  const location = values[BLOCK_IDS.location]?.location?.value?.trim() || '';
  const incident = values[BLOCK_IDS.incident]?.incident?.value?.trim() || '';
  const injuries = values[BLOCK_IDS.injuries]?.injuries?.value?.trim() || '';
  const police = values[BLOCK_IDS.police]?.police?.value?.trim() || '';
  const citationIssued = readRadio(
    values,
    BLOCK_IDS.citationIssued,
    'citation_issued',
    true
  );
  const truckDrivable = readRadio(
    values,
    BLOCK_IDS.truckDrivable,
    'truck_drivable',
    false
  );
  const truckTowingRequired = readRadio(
    values,
    BLOCK_IDS.truckTowingRequired,
    'truck_towing',
    true
  );
  const trailerDrivable = readRadio(
    values,
    BLOCK_IDS.trailerDrivable,
    'trailer_drivable',
    false
  );
  const trailerTowingRequired = readRadio(
    values,
    BLOCK_IDS.trailerTowingRequired,
    'trailer_towing',
    true
  );
  const attachmentFiles = (
    values[BLOCK_IDS.attachments]?.[ATTACHMENT_ACTION_ID]?.files || []
  )
    .filter((f) => f?.id)
    .map((f) => ({
      id: f.id,
      name: f.name || f.title || 'attachment',
    }));

  const errors = {};
  if (!driver) errors[BLOCK_IDS.driver] = 'Driver is required.';
  if (!unit) errors[BLOCK_IDS.unit] = 'Unit is required.';
  if (!accidentDate) {
    errors[BLOCK_IDS.accidentDate] = 'Date of accident is required.';
  }
  if (!accidentTime) {
    errors[BLOCK_IDS.accidentTime] = 'Time of accident is required.';
  }
  if (!location) errors[BLOCK_IDS.location] = 'Location is required.';
  if (!incident) errors[BLOCK_IDS.incident] = 'Incident description is required.';
  if (!injuries) errors[BLOCK_IDS.injuries] = 'Injuries field is required.';
  if (!police) errors[BLOCK_IDS.police] = 'Police field is required.';

  return {
    data: {
      driver,
      unit,
      trailer,
      accidentDate,
      accidentTime,
      location,
      incident,
      injuries,
      police,
      citationIssued,
      truckDrivable,
      truckTowingRequired,
      trailerDrivable,
      trailerTowingRequired,
      attachmentFiles,
    },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildRoadAccidentModal,
  parseSubmissionValues,
};
