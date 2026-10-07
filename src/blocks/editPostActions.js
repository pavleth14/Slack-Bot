function buildEditPostActionsBlock(actionId) {
  return {
    type: 'actions',
    block_id: 'form_edit_actions',
    elements: [
      {
        type: 'button',
        action_id: actionId,
        text: { type: 'plain_text', text: 'Edit submission' },
        value: 'edit',
      },
    ],
  };
}

module.exports = { buildEditPostActionsBlock };
