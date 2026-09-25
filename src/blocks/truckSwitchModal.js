const CALLBACK_ID = 'truck_switch_submit';
const BLOCK_IDS = {
  driver: 'driver_block',
  oldTruck: 'old_truck_block',
  newTruck: 'new_truck_block',
  oldTrailer: 'old_trailer_block',
  newTrailer: 'new_trailer_block',
};

function buildTruckSwitchModal() {
  return {
    type: 'modal',
    callback_id: CALLBACK_ID,
    title: { type: 'plain_text', text: 'Truck Switch' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: BLOCK_IDS.driver,
        label: { type: 'plain_text', text: 'Driver name' },
        element: {
          type: 'plain_text_input',
          action_id: 'driver',
          placeholder: { type: 'plain_text', text: 'e.g. Raibrinder Singh' },
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.oldTruck,
        label: { type: 'plain_text', text: 'Old Truck Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'old_truck',
          placeholder: { type: 'plain_text', text: 'Old truck #' },
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.newTruck,
        label: { type: 'plain_text', text: 'New Truck Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'new_truck',
          placeholder: { type: 'plain_text', text: 'New truck #' },
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.oldTrailer,
        label: { type: 'plain_text', text: 'Old Trailer Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'old_trailer',
          placeholder: { type: 'plain_text', text: 'Old trailer #' },
        },
      },
      {
        type: 'input',
        block_id: BLOCK_IDS.newTrailer,
        label: { type: 'plain_text', text: 'New Trailer Number' },
        element: {
          type: 'plain_text_input',
          action_id: 'new_trailer',
          placeholder: { type: 'plain_text', text: 'New trailer #' },
        },
      },
    ],
  };
}

function parseSubmissionValues(values) {
  const driver =
    values[BLOCK_IDS.driver]?.driver?.value?.trim() || '';
  const oldTruck =
    values[BLOCK_IDS.oldTruck]?.old_truck?.value?.trim() || '';
  const newTruck =
    values[BLOCK_IDS.newTruck]?.new_truck?.value?.trim() || '';
  const oldTrailer =
    values[BLOCK_IDS.oldTrailer]?.old_trailer?.value?.trim() || '';
  const newTrailer =
    values[BLOCK_IDS.newTrailer]?.new_trailer?.value?.trim() || '';

  const errors = {};
  if (!driver) errors[BLOCK_IDS.driver] = 'Driver name is required.';
  if (!oldTruck) errors[BLOCK_IDS.oldTruck] = 'Old truck number is required.';
  if (!newTruck) errors[BLOCK_IDS.newTruck] = 'New truck number is required.';
  if (!oldTrailer) errors[BLOCK_IDS.oldTrailer] = 'Old trailer number is required.';
  if (!newTrailer) errors[BLOCK_IDS.newTrailer] = 'New trailer number is required.';

  return {
    data: { driver, oldTruck, newTruck, oldTrailer, newTrailer },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildTruckSwitchModal,
  parseSubmissionValues,
};
