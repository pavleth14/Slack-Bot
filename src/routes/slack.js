const express = require('express');
const { verifySlackSignature } = require('../middleware/verifySlackSignature');
const {
  CALLBACK_ID,
  BLOCK_IDS,
  parseSubmissionValues,
} = require('../blocks/truckSwitchModal');
const { CALLBACK_ID: COMPLETE_CALLBACK_ID, BLOCK_IDS: COMPLETE_BLOCK_IDS } =
  require('../blocks/completeModal');
const { CALLBACK_ID: REJECT_CALLBACK_ID, BLOCK_IDS: REJECT_BLOCK_IDS } =
  require('../blocks/rejectModal');
const {
  ACTION_MARK_COMPLETE,
  ACTION_CONTROL_CONFIRM,
  ACTION_CONTROL_REJECT,
} = require('../constants/actions');
const {
  isUserAllowed,
  openTruckSwitchModal,
  processTruckSwitchSubmission,
  handleMarkCompleteAction,
  processCompleteSubmission,
  handleControlConfirmAction,
  handleControlRejectAction,
  processRejectSubmission,
  DeliveryError,
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

function deliveryErrorMessage(err) {
  if (err.mailFailed) {
    return 'Email could not be sent. Slack post was rolled back. Fix email settings and try again.';
  }
  if (err.slackFailed) {
    return 'Could not post to Slack channel. Check bot channel access and try again.';
  }
  return err.message || 'Delivery failed.';
}

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
    try {
      let ephemeral = null;
      if (actionId === ACTION_MARK_COMPLETE) {
        ephemeral = await handleMarkCompleteAction(payload);
      } else if (actionId === ACTION_CONTROL_CONFIRM) {
        ephemeral = await handleControlConfirmAction(payload);
      } else if (actionId === ACTION_CONTROL_REJECT) {
        ephemeral = await handleControlRejectAction(payload);
      }
      if (ephemeral) {
        return res.json(ephemeral);
      }
      return res.status(200).send('');
    } catch (err) {
      console.error('[interactions] block_actions failed:', err.message);
      return res.json({
        response_type: 'ephemeral',
        text: err.message || 'Action failed.',
      });
    }
  }

  if (payload.type === 'view_submission') {
    const callbackId = payload.view?.callback_id;
    const userId = payload.user?.id;

    if (callbackId === CALLBACK_ID) {
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

      try {
        await processTruckSwitchSubmission(data, userId);
        return res.json({ response_action: 'clear' });
      } catch (err) {
        console.error('[interactions] phase1 failed:', err.message);
        return res.json({
          response_action: 'errors',
          errors: {
            [BLOCK_IDS.driver]: deliveryErrorMessage(err),
          },
        });
      }
    }

    if (callbackId === COMPLETE_CALLBACK_ID) {
      if (!isUserAllowed(userId)) {
        return res.json({
          response_action: 'errors',
          errors: {
            [COMPLETE_BLOCK_IDS.updates]: 'You are not allowed to submit.',
          },
        });
      }

      try {
        await processCompleteSubmission(payload.view, userId);
        return res.json({ response_action: 'clear' });
      } catch (err) {
        if (err.validationErrors) {
          return res.json({
            response_action: 'errors',
            errors: err.validationErrors,
          });
        }
        console.error('[interactions] complete failed:', err.message);
        return res.json({
          response_action: 'errors',
          errors: {
            [COMPLETE_BLOCK_IDS.updates]: deliveryErrorMessage(err),
          },
        });
      }
    }

    if (callbackId === REJECT_CALLBACK_ID) {
      try {
        await processRejectSubmission(payload.view, userId);
        return res.json({ response_action: 'clear' });
      } catch (err) {
        if (err.validationErrors) {
          return res.json({
            response_action: 'errors',
            errors: err.validationErrors,
          });
        }
        console.error('[interactions] reject failed:', err.message);
        return res.json({
          response_action: 'errors',
          errors: {
            [REJECT_BLOCK_IDS.reason]: err.message || 'Could not save rejection.',
          },
        });
      }
    }
  }

  return res.status(200).send('');
});

module.exports = router;
