const { loadConfig } = require('../config');
const { slackClient } = require('./delivery');
const { isControlOperator } = require('./access');

const verifiedKeys = new Set();

function reactionKey(channel, messageTs, userId) {
  return `${channel}:${messageTs}:${userId}`;
}

/**
 * Control verifies by adding :white_check_mark: on a TRUCK SWITCH thread message.
 */
async function handleReactionAdded(event) {
  if (event.type !== 'reaction_added') return;
  if (event.reaction !== 'white_check_mark') return;
  if (event.item?.type !== 'message') return;

  const userId = event.user;
  if (!isControlOperator(userId)) return;

  const channel = event.item.channel;
  const messageTs = event.item.ts;
  const key = reactionKey(channel, messageTs, userId);
  if (verifiedKeys.has(key)) return;

  const client = slackClient();
  const history = await client.conversations.history({
    channel,
    latest: messageTs,
    inclusive: true,
    limit: 1,
  });

  const message = history.messages?.[0];
  if (!message?.text?.includes('TRUCK SWITCH')) return;
  if (!message.text.includes('Work Completed')) return;

  verifiedKeys.add(key);

  const threadTs = message.thread_ts || messageTs;
  await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `Control verified :white_check_mark: — <@${userId}>`,
  });
}

module.exports = { handleReactionAdded };
