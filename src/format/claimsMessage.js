const { CLAIMS_STEPS, TEXT_BY_KEY, GROUP_BY_KEY } = require('../blocks/claimsFields');
const { chunkOptions, claimIndicator } = require('../services/claimsSelection');

const SECTION_TEXT_LIMIT = 2900;
const MESSAGE_BLOCK_LIMIT = 50;

function escapeMrkdwn(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return value || '';
  return `${match[2]}-${match[3]}-${match[1]}`;
}

function displayValue(field, raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (field.type === 'date') return formatDate(value);
  if (field.money && !value.startsWith('$')) return `$${value}`;
  return value;
}

function slackOption(option) {
  return {
    value: option.value,
    text: { type: 'plain_text', text: option.text },
  };
}

function packLines(lines) {
  const blocks = [];
  let buffer = '';
  function pushBuffer() {
    if (!buffer) return;
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: buffer },
    });
    buffer = '';
  }
  for (const line of lines) {
    const chunk = line.length > SECTION_TEXT_LIMIT ? `${line.slice(0, SECTION_TEXT_LIMIT - 1)}…` : line;
    if (!buffer) {
      buffer = chunk;
      continue;
    }
    if (buffer.length + chunk.length + 1 > SECTION_TEXT_LIMIT) {
      pushBuffer();
      buffer = chunk;
      continue;
    }
    buffer = `${buffer}\n${chunk}`;
  }
  pushBuffer();
  return blocks;
}

function summaryLines(submission) {
  const lines = [];
  let section = '';
  for (const step of CLAIMS_STEPS) {
    for (const item of step.items) {
      if (!item.text) continue;
      const field = TEXT_BY_KEY[item.text];
      const value = displayValue(field, submission[field.key]);
      if (!value) continue;
      if (field.section !== section) {
        section = field.section;
        lines.push(`*${section}*`);
      }
      lines.push(`*${field.label}:* ${escapeMrkdwn(value)}`);
    }
  }
  return lines;
}

function selectedValues(group, submission) {
  const raw = submission[group.key];
  if (group.multi) return new Set(Array.isArray(raw) ? raw : []);
  return new Set(raw ? [raw] : []);
}

function checkboxBlocks(group, submission) {
  const parts = chunkOptions(group.options);
  const selected = selectedValues(group, submission);
  return parts.map((options, index) => {
    const slackOptions = options.map(slackOption);
    const initial = slackOptions.filter((option) => selected.has(option.value));
    const label =
      parts.length === 1 ? `*${group.label}*` : `*${group.label}* (${index + 1}/${parts.length})`;
    const element = {
      type: 'checkboxes',
      action_id: `claims_sel_${group.key}__p${index}`,
      options: slackOptions,
    };
    if (initial.length) element.initial_options = initial;
    return {
      type: 'section',
      block_id: `claims_grp_${group.key}__p${index}`,
      text: { type: 'mrkdwn', text: label },
      accessory: element,
    };
  });
}

function interactiveBlocks(submission) {
  const blocks = [];
  for (const step of CLAIMS_STEPS) {
    for (const item of step.items) {
      if (!item.group) continue;
      blocks.push(...checkboxBlocks(GROUP_BY_KEY[item.group], submission));
    }
  }
  return blocks;
}

function headerBlock(submission, meta, claimId) {
  const indicator = claimIndicator(submission);
  const claimNo = escapeMrkdwn(submission.claimNumber || '—');
  const by = meta?.submitterUserId ? `\n*Submitted by:* <@${meta.submitterUserId}>` : '';
  return {
    type: 'section',
    block_id: `claims_post_${claimId}`,
    text: {
      type: 'mrkdwn',
      text: `${indicator.emoji} *ONGOING CLAIM* — ${indicator.label}\n*Claim Number:* ${claimNo}${by}\n_One box per group. Document checklist and the closure list allow more than one._`,
    },
  };
}

function buildClaimsBlocks(submission, meta, claimId) {
  const header = headerBlock(submission, meta, claimId);
  const choices = interactiveBlocks(submission);
  const textBlocks = packLines(summaryLines(submission));
  const room = MESSAGE_BLOCK_LIMIT - 1 - choices.length;
  const mainText = textBlocks.slice(0, Math.max(room, 0));
  const overflowBlocks = textBlocks.slice(mainText.length);
  return {
    blocks: [header, ...mainText, ...choices],
    overflowBlocks,
  };
}

function formatClaimsFallback(submission) {
  const indicator = claimIndicator(submission);
  const num = submission.claimNumber || 'Claim';
  const driver = submission.driverName ? ` — ${submission.driverName}` : '';
  return `${indicator.emoji} ${num}${driver} — ${indicator.label}`;
}

function claimIdFromMessage(message) {
  const fromMeta = message?.metadata?.event_payload?.claimId;
  if (fromMeta) return String(fromMeta);
  const header = (message?.blocks || []).find((block) =>
    String(block.block_id || '').startsWith('claims_post_')
  );
  return header ? header.block_id.slice('claims_post_'.length) : '';
}

module.exports = {
  buildClaimsBlocks,
  formatClaimsFallback,
  claimIdFromMessage,
  MESSAGE_BLOCK_LIMIT,
};
