const CALLBACK_ID = 'road_accident_submit';

const BLOCK_IDS = {
  accidentDate: 'accident_date_block',
  accidentTime: 'accident_time_block',
  location: 'accident_location_block',
  driver: 'accident_driver_block',
  truck: 'accident_truck_block',
  trailer: 'accident_trailer_block',
  description: 'accident_description_block',
  policeInvolved: 'accident_police_involved_block',
  policeReportNumber: 'accident_police_report_block',
  towedAway: 'accident_towed_block',
  towingInfo: 'accident_towing_info_block',
  citationIssued: 'accident_citation_block',
  ambulanceAtScene: 'accident_ambulance_block',
  fuelSpillCleanup: 'accident_fuel_spill_block',
  otherPartyCollected: 'accident_other_party_block',
  attachments: 'accident_attachments_block',
};

const ATTACHMENT_ACTION_ID = 'accident_attachments';
const MAX_ATTACHMENT_FILES = 10;

const OTHER_PARTY_OPTIONS = [
  { value: 'cdl_photo', text: 'Picture of CDL' },
  { value: 'insurance_cert', text: 'Insurance info (insurance cert photo)' },
  { value: 'usdot_signs', text: 'Company signs with USDOT no.' },
  {
    value: 'cab_card',
    text: 'Registration, plate, unit # (cab card photo)',
  },
  { value: 'damage_photos', text: 'Pictures of damage' },
  { value: 'impact_photos', text: 'Pictures of impact from the scene' },
  {
    value: 'liability_statement_video',
    text: 'Liability statement / walk-around video',
  },
];

const OTHER_PARTY_LABELS = Object.fromEntries(
  OTHER_PARTY_OPTIONS.map((o) => [o.value, o.text])
);

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
    label: { type: 'plain_text', text: 'Upload photos / documents' },
    hint: {
      type: 'plain_text',
      text: 'Attach files for the items above (CDL, damage, etc.), up to 10 files.',
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
      block_id: BLOCK_IDS.accidentDate,
      label: { type: 'plain_text', text: 'Date' },
      element: { type: 'datepicker', action_id: 'accident_date' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.accidentTime,
      label: { type: 'plain_text', text: 'Time' },
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
      block_id: BLOCK_IDS.driver,
      label: { type: 'plain_text', text: 'Our Driver' },
      element: { type: 'plain_text_input', action_id: 'driver' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.truck,
      label: { type: 'plain_text', text: 'Our Truck #' },
      element: { type: 'plain_text_input', action_id: 'truck' },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.trailer,
      optional: true,
      label: { type: 'plain_text', text: 'Our Trailer #' },
      element: {
        type: 'plain_text_input',
        action_id: 'trailer',
        placeholder: { type: 'plain_text', text: '/ if none' },
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.description,
      label: { type: 'plain_text', text: 'Description' },
      element: {
        type: 'plain_text_input',
        action_id: 'description',
        multiline: true,
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.policeInvolved,
      label: { type: 'plain_text', text: 'Police involved?' },
      element: yesNoRadio('police_involved', false),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.policeReportNumber,
      optional: true,
      label: { type: 'plain_text', text: 'Police report #' },
      hint: {
        type: 'plain_text',
        text: 'Required when police were involved.',
      },
      element: {
        type: 'plain_text_input',
        action_id: 'police_report_number',
        placeholder: { type: 'plain_text', text: 'Report number' },
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.towedAway,
      label: { type: 'plain_text', text: 'Towed away?' },
      element: yesNoRadio('towed_away', false),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.towingInfo,
      optional: true,
      label: { type: 'plain_text', text: 'Towing info' },
      hint: {
        type: 'plain_text',
        text: 'Required when unit was towed.',
      },
      element: {
        type: 'plain_text_input',
        action_id: 'towing_info',
        multiline: true,
        placeholder: { type: 'plain_text', text: 'Company, destination, etc.' },
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
      block_id: BLOCK_IDS.ambulanceAtScene,
      label: { type: 'plain_text', text: 'Ambulance at the scene?' },
      element: yesNoRadio('ambulance_at_scene', false),
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.fuelSpillCleanup,
      label: { type: 'plain_text', text: 'Fuel spill / clean-up?' },
      element: yesNoRadio('fuel_spill_cleanup', false),
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Other party — information to collect*\n_Check what you collected; upload files below. Liability statement / walk-around video when no police — include other vehicle or driver when possible._',
      },
    },
    {
      type: 'input',
      block_id: BLOCK_IDS.otherPartyCollected,
      optional: true,
      label: { type: 'plain_text', text: 'Collected from other party' },
      element: {
        type: 'checkboxes',
        action_id: 'other_party_collected',
        options: OTHER_PARTY_OPTIONS.map((o) => ({
          value: o.value,
          text: { type: 'plain_text', text: o.text },
        })),
      },
    },
  ];

  if (includeAttachments) {
    blocks.push(buildAttachmentBlock());
  }

  return {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: { type: 'plain_text', text: 'Accident reporting' },
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

function parseSubmissionValues(values) {
  const accidentDate =
    values[BLOCK_IDS.accidentDate]?.accident_date?.selected_date || '';
  const accidentTime =
    values[BLOCK_IDS.accidentTime]?.accident_time?.selected_time || '';
  const location = values[BLOCK_IDS.location]?.location?.value?.trim() || '';
  const driver = values[BLOCK_IDS.driver]?.driver?.value?.trim() || '';
  const truck = values[BLOCK_IDS.truck]?.truck?.value?.trim() || '';
  const trailer = values[BLOCK_IDS.trailer]?.trailer?.value?.trim() || '';
  const description =
    values[BLOCK_IDS.description]?.description?.value?.trim() || '';
  const policeInvolved = readRadio(
    values,
    BLOCK_IDS.policeInvolved,
    'police_involved',
    true
  );
  const policeReportNumber =
    values[BLOCK_IDS.policeReportNumber]?.police_report_number?.value?.trim() ||
    '';
  const towedAway = readRadio(values, BLOCK_IDS.towedAway, 'towed_away', true);
  const towingInfo =
    values[BLOCK_IDS.towingInfo]?.towing_info?.value?.trim() || '';
  const citationIssued = readRadio(
    values,
    BLOCK_IDS.citationIssued,
    'citation_issued',
    true
  );
  const ambulanceAtScene = readRadio(
    values,
    BLOCK_IDS.ambulanceAtScene,
    'ambulance_at_scene',
    true
  );
  const fuelSpillCleanup = readRadio(
    values,
    BLOCK_IDS.fuelSpillCleanup,
    'fuel_spill_cleanup',
    true
  );
  const otherPartyCollected = (
    values[BLOCK_IDS.otherPartyCollected]?.other_party_collected
      ?.selected_options || []
  ).map((o) => o.value);
  const attachmentFiles = (
    values[BLOCK_IDS.attachments]?.[ATTACHMENT_ACTION_ID]?.files || []
  )
    .filter((f) => f?.id)
    .map((f) => ({
      id: f.id,
      name: f.name || f.title || 'attachment',
    }));

  const errors = {};
  if (!accidentDate) errors[BLOCK_IDS.accidentDate] = 'Date is required.';
  if (!accidentTime) errors[BLOCK_IDS.accidentTime] = 'Time is required.';
  if (!location) errors[BLOCK_IDS.location] = 'Location is required.';
  if (!driver) errors[BLOCK_IDS.driver] = 'Our Driver is required.';
  if (!truck) errors[BLOCK_IDS.truck] = 'Our Truck # is required.';
  if (!description) {
    errors[BLOCK_IDS.description] = 'Description is required.';
  }
  if (policeInvolved && !policeReportNumber) {
    errors[BLOCK_IDS.policeReportNumber] =
      'Police report # is required when police were involved.';
  }
  if (towedAway && !towingInfo) {
    errors[BLOCK_IDS.towingInfo] =
      'Towing info is required when the unit was towed.';
  }

  return {
    data: {
      driver,
      truck,
      trailer,
      accidentDate,
      accidentTime,
      location,
      description,
      policeInvolved,
      policeReportNumber,
      towedAway,
      towingInfo,
      citationIssued,
      ambulanceAtScene,
      fuelSpillCleanup,
      otherPartyCollected,
      attachmentFiles,
    },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  OTHER_PARTY_LABELS,
  buildRoadAccidentModal,
  parseSubmissionValues,
  readRadio,
};
