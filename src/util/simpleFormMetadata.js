const LOADS_FORM_EVENT = 'loads_form_v1';
const ACCIDENT_FORM_EVENT = 'accident_form_v1';
const TRAILER_SWITCH_FORM_EVENT = 'trailer_switch_form_v1';

function createSimpleFormMetadata(eventType, submission, submissionMeta, extra = {}) {
  return {
    event_type: eventType,
    event_payload: {
      submission,
      submissionMeta,
      ...extra,
    },
  };
}

function parseSimpleFormMetadata(message) {
  const eventType = message?.metadata?.event_type;
  const payload = message?.metadata?.event_payload;
  if (!payload?.submission || !payload?.submissionMeta?.submitterUserId) {
    return null;
  }
  return {
    eventType,
    submission: payload.submission,
    submissionMeta: payload.submissionMeta,
    extra: payload,
  };
}

module.exports = {
  LOADS_FORM_EVENT,
  ACCIDENT_FORM_EVENT,
  TRAILER_SWITCH_FORM_EVENT,
  createSimpleFormMetadata,
  parseSimpleFormMetadata,
};
