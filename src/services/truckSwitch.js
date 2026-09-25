const { WebClient } = require('@slack/web-api');
const { loadConfig } = require('../config');
const { buildTruckSwitchModal } = require('../blocks/truckSwitchModal');
const { formatChannelMessage } = require('../format/truckSwitchMessage');
const { sendTruckSwitchEmail } = require('./mail');

function isUserAllowed(userId) {
  const { allowedUserIds } = loadConfig().slack;
  if (!allowedUserIds.length) return true;
  return allowedUserIds.includes(userId);
}

async function openTruckSwitchModal(triggerId) {
  const { botToken } = loadConfig().slack;
  const client = new WebClient(botToken);

  await client.views.open({
    trigger_id: triggerId,
    view: buildTruckSwitchModal(),
  });
}

async function processTruckSwitchSubmission(submission, submitterUserId) {
  const { botToken, channelId, safetyTeamUsergroupId } = loadConfig().slack;
  const client = new WebClient(botToken);
  const meta = {
    submitterUserId,
    submittedAtIso: new Date().toISOString(),
    safetyTeamUsergroupId,
  };

  const text = formatChannelMessage(submission, meta);

  await client.chat.postMessage({
    channel: channelId,
    text,
  });

  try {
    const mailResult = await sendTruckSwitchEmail(submission, meta);
    if (!mailResult.sent) {
      console.warn('[truckSwitch] Channel post OK; email not sent:', mailResult.reason);
    }
  } catch (err) {
    console.error('[truckSwitch] Channel post OK; email failed:', err.message);
  }
}

module.exports = {
  isUserAllowed,
  openTruckSwitchModal,
  processTruckSwitchSubmission,
};
