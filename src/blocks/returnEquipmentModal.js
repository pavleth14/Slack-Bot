const CALLBACK_ID = 'return_equipment_submit';

const BLOCK_IDS = {
  driverName: 'return_equipment_driver_name_block',
  truck: 'return_equipment_truck_block',
  terminationDate: 'return_equipment_termination_date_block',
  terminationReason: 'return_equipment_termination_reason_block',
  damages: 'return_equipment_damages_block',
  mattress: 'return_equipment_mattress_block',
  truckDetailing: 'return_equipment_truck_detailing_block',
  lastStatementBalance: 'return_equipment_last_statement_balance_block',
  escrow: 'return_equipment_escrow_block',
  travelExpense: 'return_equipment_travel_expense_block',
  recoveryFee: 'return_equipment_recovery_fee_block',
};

const {
  withInitialValue,
  withInitialDate,
} = require('../util/modalInitialValues');

function singleLineBlock(blockId, label, actionId, initial, optional = false) {
  return {
    type: 'input',
    block_id: blockId,
    optional,
    label: { type: 'plain_text', text: label },
    element: withInitialValue(
      { type: 'plain_text_input', action_id: actionId },
      initial
    ),
  };
}

function multilineBlock(blockId, label, actionId, initial, optional = true) {
  return {
    type: 'input',
    block_id: blockId,
    optional,
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
      singleLineBlock(
        BLOCK_IDS.driverName,
        'Driver Name',
        'driver_name',
        initial.driverName
      ),
      singleLineBlock(BLOCK_IDS.truck, 'Truck', 'truck', initial.truck),
      {
        type: 'input',
        block_id: BLOCK_IDS.terminationDate,
        label: { type: 'plain_text', text: 'Termination Date' },
        element: withInitialDate(
          { type: 'datepicker', action_id: 'termination_date' },
          initial.terminationDate
        ),
      },
      multilineBlock(
        BLOCK_IDS.terminationReason,
        'Termination Reason',
        'termination_reason',
        initial.terminationReason
      ),
      multilineBlock(BLOCK_IDS.damages, 'Damages', 'damages', initial.damages),
      multilineBlock(BLOCK_IDS.mattress, 'Mattress', 'mattress', initial.mattress),
      multilineBlock(
        BLOCK_IDS.truckDetailing,
        'Truck Detailing',
        'truck_detailing',
        initial.truckDetailing
      ),
      singleLineBlock(
        BLOCK_IDS.lastStatementBalance,
        'Last Statement Balance',
        'last_statement_balance',
        initial.lastStatementBalance,
        true
      ),
      singleLineBlock(
        BLOCK_IDS.escrow,
        'Escrow',
        'escrow',
        initial.escrow,
        true
      ),
      singleLineBlock(
        BLOCK_IDS.travelExpense,
        'Travel Expense',
        'travel_expense',
        initial.travelExpense,
        true
      ),
      singleLineBlock(
        BLOCK_IDS.recoveryFee,
        'Recovery Fee',
        'recovery_fee',
        initial.recoveryFee,
        true
      ),
    ],
  };

  if (options.privateMetadata) {
    view.private_metadata = options.privateMetadata;
  }

  return view;
}

function formatTerminationDateForPost(isoDate) {
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
  const driverName =
    values[BLOCK_IDS.driverName]?.driver_name?.value?.trim() || '';
  const truck = values[BLOCK_IDS.truck]?.truck?.value?.trim() || '';
  const terminationDate =
    values[BLOCK_IDS.terminationDate]?.termination_date?.selected_date || '';
  const terminationReason =
    values[BLOCK_IDS.terminationReason]?.termination_reason?.value?.trim() ||
    '';
  const damages =
    values[BLOCK_IDS.damages]?.damages?.value?.trim() || '';
  const mattress =
    values[BLOCK_IDS.mattress]?.mattress?.value?.trim() || '';
  const truckDetailing =
    values[BLOCK_IDS.truckDetailing]?.truck_detailing?.value?.trim() || '';
  const lastStatementBalance =
    values[BLOCK_IDS.lastStatementBalance]?.last_statement_balance?.value?.trim() ||
    '';
  const escrow = values[BLOCK_IDS.escrow]?.escrow?.value?.trim() || '';
  const travelExpense =
    values[BLOCK_IDS.travelExpense]?.travel_expense?.value?.trim() || '';
  const recoveryFee =
    values[BLOCK_IDS.recoveryFee]?.recovery_fee?.value?.trim() || '';

  const errors = {};
  if (!driverName) {
    errors[BLOCK_IDS.driverName] = 'Driver name is required.';
  }
  if (!truck) errors[BLOCK_IDS.truck] = 'Truck is required.';
  if (!terminationDate) {
    errors[BLOCK_IDS.terminationDate] = 'Termination date is required.';
  }

  const terminationDateDisplay = formatTerminationDateForPost(terminationDate);

  return {
    data: {
      driverName,
      truck,
      terminationDate,
      terminationDateDisplay,
      terminationReason,
      damages,
      mattress,
      truckDetailing,
      lastStatementBalance,
      escrow,
      travelExpense,
      recoveryFee,
    },
    errors,
  };
}

module.exports = {
  CALLBACK_ID,
  BLOCK_IDS,
  buildReturnEquipmentModal,
  parseSubmissionValues,
  formatTerminationDateForPost,
};
