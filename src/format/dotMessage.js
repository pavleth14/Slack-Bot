const { DOT_GROUPS, GROUP_BY_KEY } = require('../blocks/dotFields');
const { chunkOptions, selectionList } = require('../services/dotSelection');
const { ACTION_EDIT_DOT } = require('../constants/formEditActions');
const { buildEditPostActionsBlock } = require('../blocks/editPostActions');

function escapeMrkdwn(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateTime(date, time) {
  if (!date) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const datePart = match ? `${match[2]}-${match[3]}-${match[1]}` : date;
  return time ? `${datePart} ${time}` : datePart;
}

function labelForOption(group, value) {
  const option = group.options.find((o) => o.value === value);
  return option ? option.text : value;
}

function formatGroupLine(group, submission) {
  const selected = selectionList(submission[group.key]);
  if (!selected.length) return `*${group.label}:* _None selected_`;
  const labels = selected.map((v) => labelForOption(group, v));
  return `*${group.label}:* ${labels.map(escapeMrkdwn).join(', ')}`;
}

function formatAttachmentsLine(submission) {
  const names = submission.attachmentNames;
  if (!names?.length) return '*Inspection Report:* _None uploaded_';
  return `*Inspection Report:* ${names.map(escapeMrkdwn).join(', ')} (see thread)`;
}

function formatSummaryText(submission, meta) {
  const by = meta?.submitterUserId
    ? `*Submitted by:* <@${meta.submitterUserId}>\n\n`
    : '';
  const trailer = submission.trailerNumber?.trim() || '/';

  return `${by}*1. Driver Information*

*Driver Name:* ${escapeMrkdwn(submission.driverName)}
*Truck Number:* ${escapeMrkdwn(submission.truckNumber)}
*Trailer Number:* ${escapeMrkdwn(trailer)}
*Date & Time:* ${escapeMrkdwn(formatDateTime(submission.inspectionDate, submission.inspectionTime))}
*Location / State:* ${escapeMrkdwn(submission.locationState)}

*3. Violations (if any)*

*Description of Violation:* ${submission.violationDescription?.trim() ? escapeMrkdwn(submission.violationDescription) : '_—_'}

*4. Supporting Documents*

${formatAttachmentsLine(submission)}

*6. Driver Confirmation*

*Additional Notes:* ${submission.additionalNotes?.trim() ? escapeMrkdwn(submission.additionalNotes) : '_—_'}

_Use the checkboxes below for inspection level, result, violation subject, citation, and status._`;
}

function formatPostBodyText(submission, meta) {
  const lines = [
    formatSummaryText(submission, meta),
    '',
    '*2. Inspection Details*',
    formatGroupLine(GROUP_BY_KEY.inspectionLevel, submission),
    formatGroupLine(GROUP_BY_KEY.inspectionResult, submission),
    '',
    '*Violation applies to*',
    formatGroupLine(GROUP_BY_KEY.violationSubjects, submission),
    '',
    '*Citation Issued*',
    formatGroupLine(GROUP_BY_KEY.citationIssued, submission),
    '',
    '*5. Current Status*',
    formatGroupLine(GROUP_BY_KEY.currentStatus, submission),
  ];
  return `*DOT ROADSIDE INSPECTION REPORT*\n\n${lines.join('\n')}`;
}

function formatPostFallbackText(submission) {
  const dt = formatDateTime(submission.inspectionDate, submission.inspectionTime);
  return `DOT Inspection — ${submission.driverName} — Truck ${submission.truckNumber} — ${dt}`;
}

function slackOption(option) {
  return {
    value: option.value,
    text: { type: 'plain_text', text: option.text },
  };
}

function checkboxBlocks(group, submission, revision) {
  const parts = chunkOptions(group.options);
  const selected = new Set(selectionList(submission[group.key]));
  return parts.map((options, index) => {
    const slackOptions = options.map(slackOption);
    const initial = slackOptions.filter((option) => selected.has(option.value));
    const label =
      parts.length === 1
        ? `*${group.label}*`
        : `*${group.label}* (${index + 1}/${parts.length})`;
    const element = {
      type: 'checkboxes',
      action_id: `dot_sel_${group.key}__p${index}__r${revision}`,
      options: slackOptions,
    };
    if (initial.length) element.initial_options = initial;
    return {
      type: 'section',
      block_id: `dot_grp_${group.key}__p${index}__r${revision}`,
      text: { type: 'mrkdwn', text: label },
      accessory: element,
    };
  });
}

function interactiveCheckboxBlocks(submission, revision) {
  const blocks = [];
  for (const group of DOT_GROUPS) {
    blocks.push(...checkboxBlocks(group, submission, revision));
  }
  return blocks;
}

function headerBlock(submission, meta, dotId) {
  const dt = formatDateTime(submission.inspectionDate, submission.inspectionTime);
  const by = meta?.submitterUserId
    ? `\n*Submitted by:* <@${meta.submitterUserId}>`
    : '';
  return {
    type: 'section',
    block_id: `dot_post_${dotId}`,
    text: {
      type: 'mrkdwn',
      text: `*DOT ROADSIDE INSPECTION REPORT*\n*Driver:* ${escapeMrkdwn(submission.driverName)} · *Truck:* ${escapeMrkdwn(submission.truckNumber)} · *${escapeMrkdwn(dt)}*${by}`,
    },
  };
}

function buildDotBlocks(submission, meta, dotId, revision = 0) {
  const summary = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: formatSummaryText(submission, meta),
    },
  };

  const choices = interactiveCheckboxBlocks(submission, revision);
  const blocks = [
    headerBlock(submission, meta, dotId),
    summary,
    ...choices,
    buildEditPostActionsBlock(ACTION_EDIT_DOT),
  ];

  return { blocks };
}

function dotIdFromMessage(message) {
  const fromMeta = message?.metadata?.event_payload?.dotId;
  if (fromMeta) return String(fromMeta);
  const header = (message?.blocks || []).find((block) =>
    String(block.block_id || '').startsWith('dot_post_')
  );
  return header ? header.block_id.slice('dot_post_'.length) : '';
}

module.exports = {
  formatPostBodyText,
  formatPostFallbackText,
  buildDotBlocks,
  dotIdFromMessage,
};
