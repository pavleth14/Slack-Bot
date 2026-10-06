const {
  CLAIMS_STEPS,
  CLAIMS_CALLBACK_IDS,
  TEXT_BY_KEY,
  GROUP_BY_KEY,
} = require('./claimsFields');
const { chunkOptions } = require('../services/claimsSelection');

const OPTION_TEXT_LIMIT = 75;
const MODAL_BLOCK_LIMIT = 100;

function slackOption(option) {
  return {
    value: option.value,
    text: { type: 'plain_text', text: option.text },
  };
}

function headerBlock(text) {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: `*${text}*` },
  };
}

function textInput(field) {
  const element = {
    type: 'plain_text_input',
    action_id: 'v',
  };
  if (field.type === 'multiline') element.multiline = true;
  if (field.placeholder) {
    element.placeholder = { type: 'plain_text', text: field.placeholder };
  }
  return {
    type: 'input',
    block_id: field.key,
    optional: !field.required,
    label: { type: 'plain_text', text: field.label },
    element,
  };
}

function dateInput(field) {
  return {
    type: 'input',
    block_id: field.key,
    optional: true,
    label: { type: 'plain_text', text: field.label },
    element: { type: 'datepicker', action_id: 'v' },
  };
}

function timeInput(field) {
  return {
    type: 'input',
    block_id: field.key,
    optional: true,
    label: { type: 'plain_text', text: field.label },
    element: { type: 'timepicker', action_id: 'v' },
  };
}

function choiceInput(group, blockId, label, options, hint) {
  const slackOptions = options.map(slackOption);
  let element;
  if (group.modal === 'select') {
    element = {
      type: 'static_select',
      action_id: 'v',
      options: slackOptions,
      placeholder: {
        type: 'plain_text',
        text: group.placeholder || 'Select',
      },
    };
  } else if (group.modal === 'checkboxes') {
    element = {
      type: 'checkboxes',
      action_id: 'v',
      options: slackOptions,
    };
  } else {
    element = {
      type: 'radio_buttons',
      action_id: 'v',
      options: slackOptions,
    };
    if (group.initial) {
      const initial = slackOptions.find((option) => option.value === group.initial);
      if (initial) element.initial_option = initial;
    }
  }

  const block = {
    type: 'input',
    block_id: blockId,
    optional: true,
    label: { type: 'plain_text', text: label },
    element,
  };
  if (hint) {
    block.hint = { type: 'plain_text', text: hint };
  }
  return block;
}

function groupBlocks(group) {
  if (group.modal === 'checkboxes') {
    const parts = chunkOptions(group.options);
    return parts.map((options, index) => {
      const label = parts.length === 1 ? group.label : `${group.label} (${index + 1}/${parts.length})`;
      return choiceInput(
        group,
        `${group.key}__p${index}`,
        label,
        options,
        index === 0 ? group.hint : ''
      );
    });
  }
  return [choiceInput(group, group.key, group.label, group.options)];
}

function fieldBlock(field) {
  if (field.type === 'date') return dateInput(field);
  if (field.type === 'time') return timeInput(field);
  return textInput(field);
}

function buildStepBlocks(step, stepIndex) {
  const blocks = [];
  if (step.intro) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: step.intro }],
    });
  }
  for (const item of step.items) {
    if (item.header) {
      blocks.push(headerBlock(item.header));
      continue;
    }
    if (item.text) {
      blocks.push(fieldBlock(TEXT_BY_KEY[item.text]));
      continue;
    }
    if (item.group) {
      blocks.push(...groupBlocks(GROUP_BY_KEY[item.group]));
    }
  }
  if (blocks.length > MODAL_BLOCK_LIMIT) {
    throw new Error(`Claims step ${stepIndex + 1} has ${blocks.length} blocks (max ${MODAL_BLOCK_LIMIT}).`);
  }
  return blocks;
}

function buildClaimsModal(stepIndex, draftId) {
  const step = CLAIMS_STEPS[stepIndex];
  return {
    type: 'modal',
    callback_id: step.callbackId,
    private_metadata: JSON.stringify({ draftId }),
    title: { type: 'plain_text', text: step.title },
    submit: { type: 'plain_text', text: step.submit },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: buildStepBlocks(step, stepIndex),
  };
}

function readElement(values, blockId) {
  const block = values?.[blockId];
  if (!block) return null;
  return block.v || Object.values(block)[0] || null;
}

function readText(element) {
  return String(element?.value || '').trim();
}

function parseClaimsStep(stepIndex, values) {
  const step = CLAIMS_STEPS[stepIndex];
  const data = {};
  const errors = {};

  for (const item of step.items) {
    if (item.header) continue;
    if (item.text) {
      const field = TEXT_BY_KEY[item.text];
      const element = readElement(values, field.key);
      let value = '';
      if (field.type === 'date') value = element?.selected_date || '';
      else if (field.type === 'time') value = element?.selected_time || '';
      else value = readText(element);
      if (field.required && !value) {
        errors[field.key] = `${field.label} is required.`;
      }
      data[field.key] = value;
      continue;
    }
    if (item.group) {
      const group = GROUP_BY_KEY[item.group];
      if (group.modal === 'checkboxes') {
        const selected = [];
        chunkOptions(group.options).forEach((_options, index) => {
          const element = readElement(values, `${group.key}__p${index}`);
          for (const option of element?.selected_options || []) {
            if (option?.value) selected.push(option.value);
          }
        });
        data[group.key] = selected;
      } else {
        const element = readElement(values, group.key);
        data[group.key] = element?.selected_option?.value || group.initial || '';
      }
    }
  }

  return { data, errors };
}

function claimsStepIndex(callbackId) {
  return CLAIMS_STEPS.findIndex((step) => step.callbackId === callbackId);
}

function firstErrorBlockId(stepIndex) {
  const step = CLAIMS_STEPS[stepIndex];
  for (const item of step.items) {
    if (item.text) return item.text;
    if (item.group) {
      const group = GROUP_BY_KEY[item.group];
      if (group.modal === 'checkboxes') return `${group.key}__p0`;
      return group.key;
    }
  }
  return 'claimNumber';
}

function assertOptionTextLengths() {
  const problems = [];
  for (const group of Object.values(GROUP_BY_KEY)) {
    for (const option of group.options) {
      if (option.text.length > OPTION_TEXT_LIMIT) {
        problems.push(`${group.key}:${option.value} (${option.text.length})`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`Option text exceeds ${OPTION_TEXT_LIMIT} characters: ${problems.join(', ')}`);
  }
}

module.exports = {
  CLAIMS_CALLBACK_IDS,
  buildClaimsModal,
  buildStepBlocks,
  parseClaimsStep,
  claimsStepIndex,
  firstErrorBlockId,
  assertOptionTextLengths,
};
