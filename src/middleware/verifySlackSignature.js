const crypto = require('crypto');
const { loadConfig } = require('../config');

const MAX_AGE_SECONDS = 60 * 5;

function verifySlackSignature(req, res, next) {
  let signingSecret;
  try {
    signingSecret = loadConfig().slack.signingSecret;
  } catch (err) {
    console.error('[slack] config error:', err.message);
    return res.status(503).send('Service not configured');
  }
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  const rawBody = req.rawBody;

  if (!timestamp || !signature || !rawBody) {
    return res.status(401).send('Invalid Slack request');
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (Number.isNaN(age) || age > MAX_AGE_SECONDS) {
    return res.status(401).send('Stale Slack request');
  }

  const base = `v0:${timestamp}:${rawBody.toString('utf8')}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(base).digest('hex');
  const expected = `v0=${hmac}`;

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
    if (!valid) return res.status(401).send('Invalid signature');
  } catch {
    return res.status(401).send('Invalid signature');
  }

  next();
}

module.exports = { verifySlackSignature };
