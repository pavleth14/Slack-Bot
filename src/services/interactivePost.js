const {
  formatPostHeaderText,
  formatSystemRowText,
  formatWorkCompletedLine,
} = require('../format/truckSwitchMessage');
const {
  ACTION_CHECK_FUEL,
  ACTION_CHECK_SAMSARA,
  ACTION_CHECK_TMS,
  ACTION_REVERT_FUEL,
  ACTION_REVERT_SAMSARA,
  ACTION_REVERT_TMS,
} = require('../constants/actions');

const REVERT_ACTION_BY_SYSTEM = {
  fuel: ACTION_REVERT_FUEL,
  samsara: ACTION_REVERT_SAMSARA,
  tms: ACTION_REVERT_TMS,
};

const METADATA_EVENT = 'truck_switch_v1';

function emptyChecks() {
  return { fuel: null, samsara: null, tms: null };
}

function createPostMetadata(submission, overrides = {}) {
  return {
    event_type: METADATA_EVENT,
    event_payload: {
      submission,
      checks: emptyChecks(),
      emailMessageId: null,
      emailSubject: null,
      workCompleteMailSent: false,
      submissionMeta: null,
      ...overrides,
    },
  };
}

function parsePostMetadata(message) {
  const payload = message?.metadata?.event_payload;
  if (!payload?.submission) return null;
  return payload;
}

function allSystemsUpdated(checks) {
  return checks.fuel && checks.samsara && checks.tms;
}

function buildMarkUpdatedButton(actionId, label) {
  return {
    type: 'button',
    action_id: actionId,
    text: { type: 'plain_text', text: label },
    value: 'mark_updated',
  };
}

function buildInteractiveBlocks(submission, meta, payload) {
  const checks = payload.checks || emptyChecks();
  const workDone = allSystemsUpdated(checks);

  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatPostHeaderText(submission, meta) },
    },
    ...buildSystemRowBlocks('fuel', ACTION_CHECK_FUEL, 'Mark updated', checks, meta),
    ...buildSystemRowBlocks('samsara', ACTION_CHECK_SAMSARA, 'Mark updated', checks, meta),
    ...buildSystemRowBlocks('tms', ACTION_CHECK_TMS, 'Mark updated', checks, meta),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Status*\n\n${formatWorkCompletedLine(workDone)}`,
      },
    },
  ];

  if (!workDone) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_Check each system when your team completes the update. Reply in thread for details._',
        },
      ],
    });
  }

  return blocks;
}

function buildSystemRowBlocks(systemKey, actionId, checkboxLabel, checks, meta) {
  const checkedBy = checks[systemKey];
  const blocks = [];

  const section = {
    type: 'section',
    block_id: `row_${systemKey}`,
    text: {
      type: 'mrkdwn',
      text: formatSystemRowText(systemKey, meta, {
        updated: Boolean(checkedBy),
      }),
    },
  };

  if (!checkedBy) {
    section.accessory = buildMarkUpdatedButton(actionId, checkboxLabel);
  } else {
    section.accessory = {
      type: 'button',
      action_id: REVERT_ACTION_BY_SYSTEM[systemKey],
      text: { type: 'plain_text', text: 'Revert' },
      value: systemKey,
    };
  }

  blocks.push(section);

  if (checkedBy) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Checked by <@${checkedBy}>`,
        },
      ],
    });
  }

  return blocks;
}

function buildPostFallbackText(submission, meta, payload) {
  const checks = payload?.checks || emptyChecks();
  const workDone = allSystemsUpdated(checks);
  return `${formatPostHeaderText(submission, meta)}\n${formatWorkCompletedLine(workDone)}`;
}

module.exports = {
  METADATA_EVENT,
  emptyChecks,
  createPostMetadata,
  parsePostMetadata,
  allSystemsUpdated,
  buildInteractiveBlocks,
  buildPostFallbackText,
};
