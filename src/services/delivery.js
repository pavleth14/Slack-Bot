const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { sendTruckSwitchEmail } = require('./mail');

class DeliveryError extends Error {
  constructor(
    message,
    { slackFailed = false, mailFailed = false, fileFailed = false, mailReason } = {}
  ) {
    super(message);
    this.name = 'DeliveryError';
    this.slackFailed = slackFailed;
    this.mailFailed = mailFailed;
    this.fileFailed = fileFailed;
    this.mailReason = mailReason;
  }
}

/**
 * Always posts to Slack first. Email runs only when MAIL_ENABLED=true; then failure rolls back Slack.
 * @param {() => Promise<{ channel?: string, ts?: string, rollback?: () => Promise<void> }>} slackPost
 */
async function deliverSlackAndEmail(slackPost, submission, meta, mailOptions = {}) {
  let rollback;
  try {
    const result = await slackPost();
    rollback = result?.rollback;
  } catch (err) {
    throw new DeliveryError(
      err.message || 'Could not post to Slack channel.',
      { slackFailed: true }
    );
  }

  const { mail } = loadConfig();
  if (!mail.enabled) {
    return { sent: false, skipped: true, reason: 'mail_disabled' };
  }

  try {
    const sendEmail = mailOptions.sendEmail || sendTruckSwitchEmail;
    const mailResult = await sendEmail(submission, meta, mailOptions);
    if (!mailResult.sent) {
      throw new DeliveryError(
        `Email was not sent (${mailResult.reason || 'unknown'}).`,
        { mailFailed: true, mailReason: mailResult.reason }
      );
    }
    return mailResult;
  } catch (err) {
    if (rollback) {
      try {
        await rollback();
      } catch (rollbackErr) {
        console.error('[delivery] rollback failed:', rollbackErr.message);
      }
    }
    if (err instanceof DeliveryError) throw err;
    throw new DeliveryError(err.message || 'Email failed.', { mailFailed: true });
  }
}

function slackClient() {
  return new WebClient(loadConfig().slack.botToken);
}

module.exports = { DeliveryError, deliverSlackAndEmail, slackClient };
