const express = require('express');
const { verifySlackSignature } = require('../middleware/verifySlackSignature');
const {
  CALLBACK_ID,
  BLOCK_IDS,
  parseSubmissionValues,
} = require('../blocks/truckSwitchModal');
const {
  CALLBACK_ID: ACCIDENT_CALLBACK_ID,
  BLOCK_IDS: ACCIDENT_BLOCK_IDS,
  parseSubmissionValues: parseAccidentSubmissionValues,
} = require('../blocks/roadAccidentModal');
const {
  CALLBACK_ID: LOADS_CALLBACK_ID,
  BLOCK_IDS: LOADS_BLOCK_IDS,
  parseSubmissionValues: parseLoadsSubmissionValues,
} = require('../blocks/loadsModal');
const {
  CALLBACK_ID: TRAILER_SWITCH_CALLBACK_ID,
  BLOCK_IDS: TRAILER_SWITCH_BLOCK_IDS,
  parseSubmissionValues: parseTrailerSwitchSubmissionValues,
} = require('../blocks/trailerSwitchModal');
const { CHECK_ACTIONS, REVERT_ACTIONS } = require('../constants/actions');
const {
  CONFIRM_CALLBACK_ID,
  CONFIRM_BLOCK_ID,
} = require('../blocks/truckSwitchConfirmModal');
const {
  isUserAllowed,
  openTruckSwitchModal,
  formatViewsOpenError,
  processTruckSwitchSubmission,
  notifySubmissionFailed,
  handleSystemMarkAction,
  handleSystemRevertAction,
  handleTruckSwitchConfirmSubmission,
} = require('../services/truckSwitch');
const {
  openRoadAccidentModal,
  processRoadAccidentSubmission,
  notifyAccidentSubmissionFailed,
} = require('../services/roadAccident');
const {
  openLoadsModal,
  processLoadsSubmission,
  notifyLoadsSubmissionFailed,
} = require('../services/loads');
const {
  openTrailerSwitchModal,
  processTrailerSwitchSubmission,
  notifyTrailerSwitchSubmissionFailed,
} = require('../services/trailerSwitch');
const { CLAIMS_CALLBACK_IDS } = require('../blocks/claimsFields');
const {
  openClaimsModal,
  handleClaimsViewSubmission,
  notifyClaimsSubmissionFailed,
  handleClaimsSelectionAction,
} = require('../services/claims');

const router = express.Router();

router.use(
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

router.use(verifySlackSignature);

async function handleSlashOpenModal(req, res, { openModal, commandLabel }) {
  const userId = req.body.user_id;
  const triggerId = req.body.trigger_id;

  if (!isUserAllowed(userId)) {
    return res.status(200).send('You are not allowed to use this command.');
  }

  try {
    await openModal(triggerId);
    return res.status(200).send('');
  } catch (err) {
    const detail = formatViewsOpenError(err);
    console.error(`[slash/${commandLabel}] views.open failed:`, detail, err.data || '');
    const hint =
      detail === 'missing_scope' || /file_input|files:read/i.test(detail)
        ? ' Add bot scopes files:read and files:write in the Slack app, reinstall to the workspace, then restart the bot. Until then set SLACK_ENABLE_MODAL_FILES=false in .env.'
        : '';
    return res.status(200).json({
      response_type: 'ephemeral',
      text: `Could not open the form (${detail}).${hint}`,
    });
  }
}

router.post('/commands/truckswitch', async (req, res) => {
  return handleSlashOpenModal(req, res, {
    openModal: openTruckSwitchModal,
    commandLabel: 'truckswitch',
  });
});

router.post('/commands/accident', async (req, res) => {
  return handleSlashOpenModal(req, res, {
    openModal: openRoadAccidentModal,
    commandLabel: 'accident',
  });
});

router.post('/commands/loads', async (req, res) => {
  return handleSlashOpenModal(req, res, {
    openModal: openLoadsModal,
    commandLabel: 'loads',
  });
});

router.post('/commands/trailerswitch', async (req, res) => {
  return handleSlashOpenModal(req, res, {
    openModal: openTrailerSwitchModal,
    commandLabel: 'trailerswitch',
  });
});

router.post('/commands/claims', async (req, res) => {
  return handleSlashOpenModal(req, res, {
    openModal: openClaimsModal,
    commandLabel: 'claims',
  });
});

router.post('/interactions', async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(req.body.payload);
  } catch {
    return res.status(400).send('Invalid payload');
  }

  if (payload.type === 'block_actions') {
    const actionId = payload.actions?.[0]?.action_id;
    if (typeof actionId === 'string' && actionId.startsWith('claims_sel_')) {
      try {
        await handleClaimsSelectionAction(payload);
      } catch (err) {
        console.error('[interactions] claims selection failed:', err.message, err.data || '');
      }
      return res.status(200).send('');
    }
    if (CHECK_ACTIONS.has(actionId) || REVERT_ACTIONS.has(actionId)) {
      try {
        if (CHECK_ACTIONS.has(actionId)) {
          await handleSystemMarkAction(payload);
        } else {
          await handleSystemRevertAction(payload);
        }
      } catch (err) {
        console.error('[interactions] mark/revert failed:', err.message, err.data || '');
      }
      return res.status(200).send('');
    }
    return res.status(200).send('');
  }

  if (
    payload.type === 'view_submission' &&
    payload.view?.callback_id === CONFIRM_CALLBACK_ID
  ) {
    try {
      const result = await handleTruckSwitchConfirmSubmission(payload);
      if (!result.ok) {
        return res.json({
          response_action: 'errors',
          errors: { [CONFIRM_BLOCK_ID]: result.error || 'Action failed.' },
        });
      }
      return res.json({ response_action: 'clear' });
    } catch (err) {
      console.error('[interactions] confirm failed:', err.message);
      return res.json({
        response_action: 'errors',
        errors: { [CONFIRM_BLOCK_ID]: err.message || 'Action failed.' },
      });
    }
  }

  if (payload.type === 'view_submission' && payload.view?.callback_id === CALLBACK_ID) {
    const userId = payload.user?.id;

    if (!isUserAllowed(userId)) {
      return res.json({
        response_action: 'errors',
        errors: {
          [BLOCK_IDS.driver]: 'You are not allowed to submit this form.',
        },
      });
    }

    const { data, errors } = parseSubmissionValues(payload.view.state.values);
    if (Object.keys(errors).length > 0) {
      return res.json({ response_action: 'errors', errors });
    }

    res.json({ response_action: 'clear' });
    processTruckSwitchSubmission(data, userId).catch((err) => {
      console.error('[interactions] phase1 failed:', err.message);
      notifySubmissionFailed(userId, err).catch(() => {});
    });
    return;
  }

  if (
    payload.type === 'view_submission' &&
    payload.view?.callback_id === ACCIDENT_CALLBACK_ID
  ) {
    const userId = payload.user?.id;

    if (!isUserAllowed(userId)) {
      return res.json({
        response_action: 'errors',
        errors: {
          [ACCIDENT_BLOCK_IDS.driver]: 'You are not allowed to submit this form.',
        },
      });
    }

    const { data, errors } = parseAccidentSubmissionValues(
      payload.view.state.values
    );
    if (Object.keys(errors).length > 0) {
      return res.json({ response_action: 'errors', errors });
    }

    res.json({ response_action: 'clear' });
    processRoadAccidentSubmission(data, userId).catch((err) => {
      console.error('[interactions] road accident failed:', err.message);
      notifyAccidentSubmissionFailed(userId, err).catch(() => {});
    });
    return;
  }

  if (
    payload.type === 'view_submission' &&
    payload.view?.callback_id === LOADS_CALLBACK_ID
  ) {
    const userId = payload.user?.id;

    if (!isUserAllowed(userId)) {
      return res.json({
        response_action: 'errors',
        errors: {
          [LOADS_BLOCK_IDS.driverName]: 'You are not allowed to submit this form.',
        },
      });
    }

    const { data, errors } = parseLoadsSubmissionValues(
      payload.view.state.values
    );
    if (Object.keys(errors).length > 0) {
      return res.json({ response_action: 'errors', errors });
    }

    res.json({ response_action: 'clear' });
    processLoadsSubmission(data, userId).catch((err) => {
      console.error('[interactions] loads failed:', err.message);
      notifyLoadsSubmissionFailed(userId, err).catch(() => {});
    });
    return;
  }

  if (
    payload.type === 'view_submission' &&
    payload.view?.callback_id === TRAILER_SWITCH_CALLBACK_ID
  ) {
    const userId = payload.user?.id;

    if (!isUserAllowed(userId)) {
      return res.json({
        response_action: 'errors',
        errors: {
          [TRAILER_SWITCH_BLOCK_IDS.action]:
            'You are not allowed to submit this form.',
        },
      });
    }

    const { data, errors } = parseTrailerSwitchSubmissionValues(
      payload.view.state.values
    );
    if (Object.keys(errors).length > 0) {
      return res.json({ response_action: 'errors', errors });
    }

    res.json({ response_action: 'clear' });
    processTrailerSwitchSubmission(data, userId).catch((err) => {
      console.error('[interactions] trailerswitch failed:', err.message);
      notifyTrailerSwitchSubmissionFailed(userId, err).catch(() => {});
    });
    return;
  }

  if (
    payload.type === 'view_submission' &&
    CLAIMS_CALLBACK_IDS.has(payload.view?.callback_id)
  ) {
    const result = handleClaimsViewSubmission(payload);
    res.json(result.body);
    if (result.after) {
      const userId = payload.user?.id;
      result.after().catch((err) => {
        console.error('[interactions] claims failed:', err.message);
        notifyClaimsSubmissionFailed(userId, err).catch(() => {});
      });
    }
    return;
  }

  return res.status(200).send('');
});

module.exports = router;
