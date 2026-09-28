const express = require('express');
const { verifySlackSignature } = require('../middleware/verifySlackSignature');
const { handleReactionAdded } = require('../services/reactions');

const router = express.Router();

router.post(
  '/',
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
  verifySlackSignature,
  async (req, res) => {
    const body = req.body;

    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    if (body.type === 'event_callback') {
      res.status(200).send('');

      try {
        if (body.event?.type === 'reaction_added') {
          await handleReactionAdded(body.event);
        }
      } catch (err) {
        console.error('[events] handler failed:', err.message);
      }
      return;
    }

    return res.status(200).send('');
  }
);

module.exports = router;
