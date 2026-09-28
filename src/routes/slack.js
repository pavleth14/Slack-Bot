const express = require('express');
const { verifySlackSignature } = require('../middleware/verifySlackSignature');
const {
  CALLBACK_ID,
  BLOCK_IDS,
  parseSubmissionValues,
} = require('../blocks/truckSwitchModal');
const { CHECK_ACTIONS } = require('../constants/actions');
const {
  isUserAllowed,
  openTruckSwitchModal,
  processTruckSwitchSubmission,
  notifySubmissionFailed,
  handleSystemCheckboxAction,
} = require('../services/truckSwitch');

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

router.post('/commands/truckswitch', async (req, res) => {
  const userId = req.body.user_id;
  const triggerId = req.body.trigger_id;

  if (!isUserAllowed(userId)) {
    return res.status(200).send('You are not allowed to use this command.');
  }

  res.status(200).send('');

  try {
    await openTruckSwitchModal(triggerId);
  } catch (err) {
    console.error('[slash/truckswitch] views.open failed:', err.message);
  }
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
    if (CHECK_ACTIONS.has(actionId)) {
      res.status(200).send('');
      handleSystemCheckboxAction(payload).catch((err) => {
        console.error('[interactions] checkbox failed:', err.message);
      });
      return;
    }
    return res.status(200).send('');
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

  return res.status(200).send('');
});

module.exports = router;
